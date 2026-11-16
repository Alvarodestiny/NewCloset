import { guessCategory } from './category';
import { Category } from './types';

export interface ImportedProduct {
  name: string;
  imageUrl?: string;
  brand?: string;
  price?: string;
  category: Category;
  sourceUrl: string;
}

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

/** Pulls the first http(s) URL out of whatever the user pasted (share sheets often add text). */
export function extractUrl(input: string): string | null {
  const match = input.match(/https?:\/\/[^\s"'<>]+/i);
  return match ? match[0] : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function metaContent(html: string, key: string): string | undefined {
  // Matches <meta property="og:title" content="..."> in either attribute order.
  const k = key.replace(/[.:]/g, (c) => `\\${c}`);
  const re1 = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${k}["']`, 'i');
  const m = html.match(re1) ?? html.match(re2);
  return m ? decodeEntities(m[1]) : undefined;
}

type Json = Record<string, unknown>;

function findProductNode(node: unknown): Json | undefined {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findProductNode(n);
      if (found) return found;
    }
    return undefined;
  }
  const obj = node as Json;
  const type = obj['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.includes('Product') || types.includes('ProductGroup')) return obj;
  if (obj['@graph']) return findProductNode(obj['@graph']);
  return undefined;
}

function firstString(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return firstString(v[0]);
  if (v && typeof v === 'object') {
    const o = v as Json;
    return firstString(o.url ?? o.contentUrl ?? o.name);
  }
  return undefined;
}

function jsonLdProduct(html: string): Partial<ImportedProduct> {
  const scripts = html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  for (const s of scripts) {
    try {
      const product = findProductNode(JSON.parse(s[1].trim()));
      if (!product) continue;
      const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
      const offer = (offers ?? {}) as Json;
      const price = offer.price ?? offer.lowPrice;
      const currency = offer.priceCurrency;
      return {
        name: firstString(product.name),
        imageUrl: firstString(product.image),
        brand: firstString(product.brand),
        price: price != null ? `${price}${currency ? ` ${currency}` : ''}` : undefined,
      };
    } catch {
      // malformed JSON-LD: try next block
    }
  }
  return {};
}

function absolute(url: string | undefined, base: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url, base);
    if (u.protocol === 'http:') u.protocol = 'https:'; // iOS blocks plain http
    // Shopify & similar CDNs: ask for a bigger image than the thumbnail size.
    for (const key of ['width', 'w', 'height', 'h']) {
      if (u.searchParams.has(key) && Number(u.searchParams.get(key)) < 800) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return undefined;
  }
}

function nameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const slug = u.pathname.split('/').filter(Boolean).pop() ?? u.hostname;
    return decodeURIComponent(slug)
      .replace(/\.(html?|php|aspx?)$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b[pP]?\d{5,}\b/g, '')
      .trim() || u.hostname;
  } catch {
    return 'Prenda';
  }
}

/**
 * Downloads a product page and extracts name, image, brand and price
 * from JSON-LD (schema.org Product), OpenGraph and Twitter meta tags.
 * Runs on-device, so there are no CORS limits on iOS/Android.
 */
export async function importFromUrl(rawUrl: string): Promise<ImportedProduct> {
  const url = extractUrl(rawUrl) ?? rawUrl;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!res.ok) throw new Error(`La tienda respondió ${res.status}`);
  const html = await res.text();
  const finalUrl = res.url || url;

  const ld = jsonLdProduct(html);
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const name =
    ld.name ??
    metaContent(html, 'og:title') ??
    metaContent(html, 'twitter:title') ??
    (titleTag ? decodeEntities(titleTag) : undefined) ??
    nameFromUrl(finalUrl);
  const imageUrl = absolute(
    ld.imageUrl ?? metaContent(html, 'og:image') ?? metaContent(html, 'og:image:secure_url') ?? metaContent(html, 'twitter:image'),
    finalUrl,
  );
  const brand = ld.brand ?? metaContent(html, 'product:brand') ?? metaContent(html, 'og:site_name');
  const priceAmount = metaContent(html, 'product:price:amount') ?? metaContent(html, 'og:price:amount');
  const priceCurrency = metaContent(html, 'product:price:currency') ?? metaContent(html, 'og:price:currency');
  const price = ld.price ?? (priceAmount ? `${priceAmount}${priceCurrency ? ` ${priceCurrency}` : ''}` : undefined);
  const cleanName = name.split(/\s[|–-]\s/)[0].trim();
  const description = metaContent(html, 'og:description') ?? metaContent(html, 'description');

  return {
    name: cleanName,
    imageUrl,
    brand,
    price,
    category: guessCategory(cleanName, finalUrl, description),
    sourceUrl: finalUrl,
  };
}
