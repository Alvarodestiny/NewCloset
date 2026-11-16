/**
 * NewCloset AI backend.
 *
 * POST /cutout    { imageUrl | image: <base64>, category }
 *   Removes the background (free, runs locally with ONNX models) and returns
 *   a transparent WebP plus the garment's shape so the app can fit it.
 *
 * POST /identify  { image: <base64>, mediaType: "image/jpeg" }
 *   1. Claude looks at the photo and describes the garment (structured output).
 *   2. Claude runs a web search to find shops that sell it.
 *
 * The Anthropic API key stays here (ANTHROPIC_API_KEY), never in the app.
 * Deploy anywhere that runs Node (Railway, Render, Fly.io, a VPS…).
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { z } from 'zod';
import { Category, cutout } from './segment.ts';

const client = new Anthropic();
const MODEL = 'claude-opus-5-5';
const PORT = Number(process.env.PORT ?? 8787);
const MAX_BODY = 8 * 1024 * 1024; // 8 MB
const FALLBACK = { betas: ['server-side-fallback-2026-07-01' as Anthropic.AnthropicBeta], fallbacks: 'default' as const };

const Garment = z.object({
  is_garment: z.boolean().describe('false if the photo does not show clothing, shoes or a fashion accessory'),
  name: z.string().describe('Short product-style name in Spanish, e.g. "Camisa de lino oversize"'),
  category: z.enum(['top', 'bottom', 'shoes', 'outerwear', 'dress', 'accessory']),
  color: z.string().describe('Main colour in Spanish'),
  brand_guess: z.string().nullable().describe('Brand only if a logo or very distinctive design makes it clear, otherwise null'),
  search_query: z.string().describe('Concise shopping search query (brand if known, garment type, colour, key details)'),
});

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
const MEDIA_TYPES: MediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

async function describe(image: string, mediaType: MediaType) {
  const res = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: 'low', format: betaZodOutputFormat(Garment) },
    ...FALLBACK,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: 'Identify the main garment in this photo so the user can add it to their digital wardrobe and find it in online shops.' },
        ],
      },
    ],
  });
  if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error('No se pudo analizar la foto');
  return res.parsed_output;
}

async function findShops(query: string) {
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low' },
    ...FALLBACK,
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 2 }],
    messages: [
      {
        role: 'user',
        content: `Search for online shop product pages selling: "${query}". Prefer direct product pages from fashion retailers in Spain/Europe. Reply with just "ok" when done.`,
      },
    ],
  });
  const seen = new Set<string>();
  const results: { title: string; url: string }[] = [];
  for (const block of res.content) {
    if (block.type !== 'web_search_tool_result' || !Array.isArray(block.content)) continue; // error => object
    for (const r of block.content) {
      if (r.type === 'web_search_result' && !seen.has(r.url)) {
        seen.add(r.url);
        results.push({ title: r.title, url: r.url });
      }
    }
  }
  return results.slice(0, 8);
}

const CATEGORIES: Category[] = ['top', 'bottom', 'shoes', 'outerwear', 'dress', 'accessory'];

function isPrivateIp(ip: string) {
  return (
    /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) ||
    ip === '::1' ||
    /^f[cd]/i.test(ip) ||
    /^fe80/i.test(ip) ||
    ip.startsWith('::ffff:127.')
  );
}

/** Downloads a shop image, refusing internal addresses (SSRF protection). */
async function downloadImage(rawUrl: string): Promise<Buffer> {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('URL de imagen no válida');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.some(isPrivateIp)) throw new Error('URL de imagen no válida');
  const res = await fetch(url, { redirect: 'error', headers: { 'User-Agent': 'Mozilla/5.0 NewCloset' } });
  if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status})`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_BODY) throw new Error('Imagen demasiado grande');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BODY) throw new Error('Imagen demasiado grande');
  return buf;
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<any> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('Imagen demasiado grande');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true });
  if (req.method === 'POST' && req.url === '/cutout') {
    try {
      const { image, imageUrl, category } = await readJson(req);
      if (!CATEGORIES.includes(category)) return send(res, 400, { error: 'Categoría no válida' });
      const input = typeof image === 'string' && image ? Buffer.from(image, 'base64') : typeof imageUrl === 'string' ? await downloadImage(imageUrl) : null;
      if (!input) return send(res, 400, { error: 'Falta la imagen' });
      const out = await cutout(input, category);
      return send(res, 200, { image: out.data.toString('base64'), mediaType: 'image/webp', width: out.width, height: out.height, fit: out.fit });
    } catch (err) {
      console.error('cutout', err);
      return send(res, 422, { error: (err as Error).message || 'No se pudo recortar la prenda' });
    }
  }
  if (req.method !== 'POST' || req.url !== '/identify') return send(res, 404, { error: 'Not found' });

  try {
    const { image, mediaType } = await readJson(req);
    if (typeof image !== 'string' || !image) return send(res, 400, { error: 'Falta la imagen' });
    const type: MediaType = MEDIA_TYPES.includes(mediaType) ? mediaType : 'image/jpeg';

    const garment = await describe(image, type);
    if (!garment.is_garment) return send(res, 422, { error: 'No hemos detectado ninguna prenda en la foto' });

    const results = await findShops(garment.search_query);
    send(res, 200, {
      name: garment.name,
      category: garment.category,
      color: garment.color,
      brandGuess: garment.brand_guess,
      searchQuery: garment.search_query,
      results,
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'Demasiadas peticiones, prueba en un momento' });
    if (err instanceof Anthropic.APIError) {
      console.error('Anthropic error', err.status, err.message);
      return send(res, 502, { error: 'El servicio de IA no está disponible ahora mismo' });
    }
    console.error(err);
    send(res, 500, { error: (err as Error).message || 'Error interno' });
  }
}).listen(PORT, () => console.log(`NewCloset AI server on http://localhost:${PORT}`));
