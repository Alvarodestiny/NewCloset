import { Category, GarmentFit } from '../types';
import { BodyModel, referenceBody } from './model';

/** A garment image placed in body space (cm). */
export interface Placement {
  cx: number; // horizontal centre
  top: number; // y of the image's top edge
  w: number;
  h: number;
  mirror?: boolean;
  /** Horizontal bands (fractions of h) each stretched by sx to follow the body's shape. */
  bands?: { t0: number; t1: number; sx: number }[];
}

const BANDS = 40;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function rowWidth(fit: GarmentFit, i: number) {
  const r = fit.rows[i];
  return r ? r[1] - r[0] : 0;
}
function rowCenter(fit: GarmentFit, i: number) {
  const r = fit.rows[i];
  return r ? (r[0] + r[1]) / 2 : 0.5;
}
const rowY = (fit: GarmentFit, i: number) => (i + 0.5) / fit.rows.length;

/**
 * Per-band horizontal stretch: how much wider/narrower the user's body is than the
 * reference body (the one shop models roughly have) at each height, relative to the
 * anchor line where the garment was fitted.
 */
function bodyBands(model: BodyModel, p: Placement, anchorY: number): Placement['bands'] {
  const ref = referenceBody(model.measurements.base);
  const k = ref.anchors.height / model.anchors.height;
  const refAnchor = anchorY * k;
  const u0 = model.halfWidthAt(anchorY);
  const r0 = ref.halfWidthAt(refAnchor);
  const bands: NonNullable<Placement['bands']> = [];
  for (let i = 0; i < BANDS; i++) {
    const t0 = i / BANDS;
    const t1 = (i + 1) / BANDS;
    const y = p.top - ((t0 + t1) / 2) * p.h;
    if (y < model.anchors.ankleY) {
      bands.push({ t0, t1, sx: bands.length ? bands[bands.length - 1].sx : 1 });
      continue;
    }
    const user = model.halfWidthAt(y) / u0;
    const refRatio = ref.halfWidthAt(y * k) / r0;
    bands.push({ t0, t1, sx: clamp(user / refRatio, 0.75, 1.45) });
  }
  // Fabric drapes: follow the overall trend (least-squares line) instead of every
  // bump, so the garment edge stays straight and bands never show as steps.
  const valid = bands.filter((_, i) => p.top - ((i + 0.5) / BANDS) * p.h >= model.anchors.ankleY);
  const n = valid.length || 1;
  const mt = valid.reduce((acc, b) => acc + (b.t0 + b.t1) / 2, 0) / n;
  const ms = valid.reduce((acc, b) => acc + b.sx, 0) / n;
  let num = 0;
  let den = 0;
  for (const b of valid) {
    const t = (b.t0 + b.t1) / 2 - mt;
    num += t * (b.sx - ms);
    den += t * t;
  }
  const slope = den ? num / den : 0;
  return bands.map((b) => ({ ...b, sx: clamp(ms + slope * ((b.t0 + b.t1) / 2 - mt), 0.8, 1.4) }));
}

/**
 * The shoulder point is where the outline stops spreading sideways quickly (the
 * shoulder slope) and starts going down (the sleeve or the body side).
 */
function shoulderRow(fit: GarmentFit): number {
  const n = fit.rows.length;
  const perRow = n / fit.aspect; // converts a width fraction per row into a real slope
  let first = 0;
  while (first < n - 1 && !fit.rows[first]) first++;
  for (let i = first + 1; i < Math.round(n * 0.4); i++) {
    const prev = fit.rows[i - 1];
    const cur = fit.rows[i];
    if (!prev || !cur) continue;
    const spread = ((prev[0] - cur[0]) + (cur[1] - prev[1])) / 2; // outward movement of both edges
    if (spread * perRow < 1) return i - 1;
  }
  return Math.min(first + 2, n - 1);
}

function fitUpper(category: Category, fit: GarmentFit, model: BodyModel): Placement {
  const a = model.anchors;
  const s = shoulderRow(fit);
  const ease = category === 'outerwear' ? 1.12 : category === 'dress' ? 1.02 : 1.05;
  const span = a.shoulderHalf * 2 * ease;
  const w = span / Math.max(0.15, rowWidth(fit, s));
  let h = w * fit.aspect;
  const top = a.shoulderY + rowY(fit, s) * h - 1;
  if (top - h < 0) h = top; // long dresses / coats stop at the floor
  const p: Placement = { cx: -(rowCenter(fit, s) - 0.5) * w, top, w, h };
  p.bands = bodyBands(model, p, a.shoulderY - 6);
  return p;
}

function fitLower(fit: GarmentFit, model: BodyModel): Placement {
  const a = model.anchors;
  // Waistband: widest row near the top (belt loops, hands or a belt can make the very first rows narrow).
  const n = fit.rows.length;
  let first = 0;
  while (first < n - 1 && !fit.rows[first]) first++;
  let s = first;
  for (let i = first; i <= Math.min(n - 1, first + Math.ceil(n * 0.12)); i++) if (rowWidth(fit, i) > rowWidth(fit, s)) s = i;
  const beltY = a.waistY - 0.3 * (a.waistY - a.hipY);
  const span = model.halfWidthAt(beltY) * 2 * 1.05;
  const w = span / Math.max(0.15, rowWidth(fit, s));
  let h = w * fit.aspect;
  const top = beltY + rowY(fit, s) * h;
  // Long trousers: match the user's leg length (hem at the ankle).
  if (h > (beltY - a.kneeY) * 1.25) h = top - (a.ankleY - 1.5);
  const p: Placement = { cx: -(rowCenter(fit, s) - 0.5) * w, top, w, h };
  p.bands = bodyBands(model, p, beltY);
  return p;
}

function fitShoes(fit: GarmentFit, model: BodyModel): Placement[] {
  const a = model.anchors;
  if (fit.pieces >= 2) {
    const w = (a.ankleX + a.footWidth * 0.6) * 2 * 1.2;
    const h = w * fit.aspect;
    return [{ cx: 0, top: h - 0.5, w, h }];
  }
  // A single shoe photographed from the side: show it on both feet, toes pointing out.
  let first = 0;
  while (first < fit.rows.length - 1 && !fit.rows[first]) first++;
  const toeLeft = rowCenter(fit, first) > 0.5; // the tall heel collar is at the top of the image
  const w = a.footLength * 1.05;
  const h = Math.min(w * fit.aspect, a.ankleY * 2.6);
  const off = a.ankleX + w * 0.16;
  return [
    { cx: -off, top: h - 0.5, w, h, mirror: !toeLeft },
    { cx: off, top: h - 0.5, w, h, mirror: toeLeft },
  ];
}

function fitAccessory(fit: GarmentFit, model: BodyModel): Placement {
  const a = model.anchors;
  const max = a.height * 0.17;
  const w = fit.aspect > 1 ? max / fit.aspect : max;
  const h = w * fit.aspect;
  return { cx: a.hand[0] + w * 0.15, top: a.hand[1] + h * 0.35, w, h };
}

/** Where a cut-out garment goes on this body. */
export function fitGarment(category: Category, fit: GarmentFit, model: BodyModel): Placement[] {
  switch (category) {
    case 'top':
    case 'outerwear':
    case 'dress':
      return [fitUpper(category, fit, model)];
    case 'bottom':
      return [fitLower(fit, model)];
    case 'shoes':
      return fitShoes(fit, model);
    case 'accessory':
      return [fitAccessory(fit, model)];
  }
}

/** Placement for garments that still have their original (non cut-out) photo. */
export function fallbackPlacement(category: Category, model: BodyModel): Placement {
  const a = model.anchors;
  const box = (top: number, bottom: number, halfW: number): Placement => ({ cx: 0, top, w: halfW * 2, h: top - bottom });
  switch (category) {
    case 'top': return box(a.shoulderY + 3, a.hipY, a.shoulderHalf * 0.9);
    case 'outerwear': return box(a.shoulderY + 4, a.crotchY - 4, a.shoulderHalf * 1.15);
    case 'dress': return box(a.shoulderY + 3, a.kneeY, a.shoulderHalf * 0.95);
    case 'bottom': return box(a.waistY, a.ankleY, model.halfWidthAt(a.hipY) * 1.05);
    case 'shoes': return box(a.ankleY * 2.4, -1, a.ankleX + a.footWidth);
    case 'accessory': return { cx: a.hand[0] + 4, top: a.hand[1] + 9, w: 16, h: 16 };
  }
}
