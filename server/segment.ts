/**
 * Garment cut-out: removes the background of a garment photo and describes
 * its shape so the app can fit it onto the mannequin.
 *
 * Models (download with `npm run models`, MIT / Apache-2.0 licensed):
 *  - u2net_cloth_seg: segments upper / lower / full-body clothes worn by a person.
 *    Lets us lift just the T-shirt out of a shop photo where a model wears it.
 *  - isnet-general-use: generic salient-object cut-out for flat-lays, shoes, bags…
 */
import * as ort from 'onnxruntime-node';
import sharp, { Sharp } from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export type Category = 'top' | 'bottom' | 'shoes' | 'outerwear' | 'dress' | 'accessory';

export interface GarmentFit {
  /** Height / width of the trimmed cut-out. */
  aspect: number;
  /** For ROWS evenly spaced rows (top→bottom): [left, right] extent as 0..1 of width, or null if empty. */
  rows: ([number, number] | null)[];
  /** Number of separate pieces (e.g. 2 for a pair of shoes). */
  pieces: number;
  /** Which model produced the mask. */
  method: 'cloth' | 'object';
}

export interface CutoutResult {
  data: Buffer; // WebP with alpha
  width: number;
  height: number;
  fit: GarmentFit;
}

const ROWS = 32;
const MODELS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'models');

let clothSession: Promise<ort.InferenceSession> | null = null;
let objectSession: Promise<ort.InferenceSession> | null = null;
const cloth = () => (clothSession ??= ort.InferenceSession.create(path.join(MODELS_DIR, 'u2net_cloth_seg.onnx')));
const object = () => (objectSession ??= ort.InferenceSession.create(path.join(MODELS_DIR, 'isnet-general-use.onnx')));

/** RGB → normalized CHW float tensor, as rembg does (divide by max, then mean/std). */
async function toTensor(img: Sharp, size: number, mean: number[], std: number[]) {
  const { data } = await img.clone().removeAlpha().resize(size, size, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  let max = 1e-6;
  for (let i = 0; i < data.length; i++) if (data[i] > max) max = data[i];
  const plane = size * size;
  const out = new Float32Array(3 * plane);
  for (let p = 0; p < plane; p++) {
    for (let c = 0; c < 3; c++) out[c * plane + p] = (data[p * 3 + c] / max - mean[c]) / std[c];
  }
  return new ort.Tensor('float32', out, [1, 3, size, size]);
}

/** Probability (0..255) that each pixel belongs to the garment, at model resolution. */
async function clothMask(img: Sharp, category: Category): Promise<{ mask: Uint8Array; size: number; clothing: number }> {
  const size = 768;
  const session = await cloth();
  const res = await session.run({ input: await toTensor(img, size, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]) });
  const logits = res.output.data as Float32Array; // [1, 4, 768, 768]: background, upper, lower, full
  const plane = size * size;
  const wanted = category === 'bottom' ? [2] : category === 'dress' ? [1, 2, 3] : [1, 3];
  const mask = new Uint8Array(plane);
  let clothingPixels = 0;
  for (let p = 0; p < plane; p++) {
    let maxLogit = -Infinity;
    let best = 0;
    for (let c = 1; c < 4; c++) if (logits[c * plane + p] > logits[best * plane + p]) best = c;
    if (best > 0) clothingPixels++;
    for (let c = 0; c < 4; c++) maxLogit = Math.max(maxLogit, logits[c * plane + p]);
    let sum = 0;
    let hit = 0;
    for (let c = 0; c < 4; c++) {
      const e = Math.exp(logits[c * plane + p] - maxLogit);
      sum += e;
      if (wanted.includes(c)) hit += e;
    }
    mask[p] = Math.round((hit / sum) * 255);
  }
  return { mask, size, clothing: clothingPixels / plane };
}

async function objectMask(img: Sharp): Promise<{ mask: Uint8Array; size: number }> {
  const size = 1024;
  const session = await object();
  const res = await session.run({ input_image: await toTensor(img, size, [0.5, 0.5, 0.5], [1, 1, 1]) });
  const pred = res.output_image.data as Float32Array; // [1, 1, 1024, 1024]
  let mi = Infinity;
  let ma = -Infinity;
  for (const v of pred) {
    if (v < mi) mi = v;
    if (v > ma) ma = v;
  }
  const mask = new Uint8Array(size * size);
  for (let i = 0; i < mask.length; i++) mask[i] = Math.round(((pred[i] - mi) / (ma - mi || 1)) * 255);
  return { mask, size };
}

function coverage(mask: Uint8Array) {
  let n = 0;
  for (const v of mask) if (v > 127) n++;
  return n / mask.length;
}

/** Counts blobs bigger than 15% of the largest one on a small binary grid. */
function countPieces(alpha: Uint8Array, w: number, h: number): number {
  const seen = new Uint8Array(w * h);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || alpha[start] < 128) continue;
    let size = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const x = i % w;
      const y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (!seen[j] && alpha[j] >= 128) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    sizes.push(size);
  }
  const largest = Math.max(0, ...sizes);
  return sizes.filter((s) => s >= largest * 0.15).length;
}

/** Keeps only blobs that are at least 10% of the largest one (removes stray specks). */
function keepMainBlobs(alpha: Uint8Array, w: number, h: number) {
  const label = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (label[start] >= 0 || alpha[start] < 100) continue;
    const id = sizes.length;
    let size = 0;
    stack.push(start);
    label[start] = id;
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const x = i % w;
      const y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (label[j] < 0 && alpha[j] >= 100) {
          label[j] = id;
          stack.push(j);
        }
      }
    }
    sizes.push(size);
  }
  const largest = Math.max(0, ...sizes);
  for (let i = 0; i < alpha.length; i++) {
    if (label[i] >= 0 && sizes[label[i]] < largest * 0.1) alpha[i] = 0;
  }
}

export async function cutout(input: Buffer, category: Category): Promise<CutoutResult> {
  // Honour EXIF orientation, flatten transparency onto white and work at a sane resolution.
  const { data: rgb, info } = await sharp(input)
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize(1400, 1400, { fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const img = sharp(rgb, { raw: { width: W, height: H, channels: 3 } });

  const apparel = category !== 'shoes' && category !== 'accessory';
  let method: GarmentFit['method'] = 'object';
  let result: { mask: Uint8Array; size: number; clothing?: number } = apparel ? await clothMask(img, category) : await objectMask(img);
  if (apparel) {
    method = 'cloth';
    const clothing = result.clothing ?? 0;
    // Only fall back to the generic cut-out when the cloth model sees no clothes at all
    // (a flat product shot on a plain background). If a person is wearing clothes,
    // the generic model would cut out the whole person.
    if (coverage(result.mask) < 0.005 && clothing < 0.04) {
      result = await objectMask(img);
      method = 'object';
    } else if (coverage(result.mask) < 0.005) {
      throw new Error('No encontramos esa prenda en la foto. Revisa la categoría.');
    }
  }

  // Upscale soft mask to working size with smooth interpolation, then sharpen the edge a bit.
  const alpha = await sharp(Buffer.from(result.mask), { raw: { width: result.size, height: result.size, channels: 1 } })
    .resize(W, H, { fit: 'fill', kernel: 'cubic' })
    .extractChannel(0)
    .raw()
    .toBuffer();
  for (let i = 0; i < alpha.length; i++) {
    const v = (alpha[i] - 90) / (200 - 90);
    alpha[i] = Math.round(Math.min(1, Math.max(0, v)) * 255);
  }
  keepMainBlobs(alpha, W, H);

  // Bounding box of the garment.
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (alpha[y * W + x] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error('No se encontró ninguna prenda en la imagen');
  const pad = 4;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(W - 1, x1 + pad);
  y1 = Math.min(H - 1, y1 + pad);
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;

  const rgba = Buffer.alloc(cw * ch * 4);
  const cropAlpha = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = (y + y0) * W + (x + x0);
      const di = y * cw + x;
      rgba[di * 4] = rgb[si * 3];
      rgba[di * 4 + 1] = rgb[si * 3 + 1];
      rgba[di * 4 + 2] = rgb[si * 3 + 2];
      rgba[di * 4 + 3] = alpha[si];
      cropAlpha[di] = alpha[si];
    }
  }

  // Shape profile: horizontal extent per row.
  const rows: GarmentFit['rows'] = [];
  for (let r = 0; r < ROWS; r++) {
    const y = Math.min(ch - 1, Math.round(((r + 0.5) / ROWS) * ch));
    let l = -1;
    let rr = -1;
    for (let x = 0; x < cw; x++) {
      if (cropAlpha[y * cw + x] > 127) {
        if (l < 0) l = x;
        rr = x;
      }
    }
    rows.push(l < 0 ? null : [+(l / cw).toFixed(4), +(rr / cw).toFixed(4)]);
  }

  // Pieces counted on a small copy (fast, ignores thin gaps).
  const small = 96;
  const sw = cw >= ch ? small : Math.max(8, Math.round((small * cw) / ch));
  const sh = ch >= cw ? small : Math.max(8, Math.round((small * ch) / cw));
  const smallAlpha = await sharp(Buffer.from(cropAlpha), { raw: { width: cw, height: ch, channels: 1 } }).resize(sw, sh, { fit: 'fill' }).extractChannel(0).raw().toBuffer();
  const pieces = countPieces(new Uint8Array(smallAlpha), sw, sh);

  const maxSide = 1000;
  const out = sharp(rgba, { raw: { width: cw, height: ch, channels: 4 } });
  const resized = Math.max(cw, ch) > maxSide ? out.resize({ width: cw >= ch ? maxSide : undefined, height: ch > cw ? maxSide : undefined }) : out;
  const { data, info: outInfo } = await resized.webp({ quality: 88, alphaQuality: 90 }).toBuffer({ resolveWithObject: true });

  return { data, width: outInfo.width, height: outInfo.height, fit: { aspect: ch / cw, rows, pieces, method } };
}
