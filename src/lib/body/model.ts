/**
 * Parametric human body built from tape measurements.
 *
 * The body is a set of "limbs" (torso, neck, head, arms, legs, feet). Each limb is a
 * sequence of cross-section rings; the 3D mesh is lofted through them and the 2D
 * front view / garment fitting read the very same rings, so everything stays in sync.
 *
 * Units: centimetres. Axes: y up from the floor, x to the mannequin's left side
 * (screen right when it faces you), z towards the viewer.
 */
import { BodyMeasurements, BodyPartId, DEFAULT_BODY } from './measurements';

export type Vec3 = [number, number, number];

/** Angles (radians) of the anatomical bumps: 0 = +x, PI/2 = front (+z). */
export const BUMP_ANGLES = [Math.PI / 2 - 0.42, Math.PI / 2 + 0.42, -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45];
export const BUMP_WIDTHS = [0.58, 0.58, 0.55, 0.55];

export interface Ring {
  c: Vec3;
  a: number; // half size along x
  b: number; // half size along z (plane xz) or y (plane xy)
  n: number; // superellipse exponent (2 = ellipse)
  bumps: [number, number, number, number]; // bust R/L, glute R/L amplitude (cm)
}

export interface Limb {
  part: BodyPartId;
  plane: 'xz' | 'xy';
  radial: number;
  rings: Ring[]; // dense, already interpolated
  /** Optional per-ring part override (torso is split into shoulders/chest/waist/hips). */
  ringParts?: BodyPartId[];
}

export interface BodyAnchors {
  height: number;
  headTop: number;
  chinY: number;
  headCenter: Vec3;
  headHalfWidth: number;
  headHalfHeight: number;
  neckRadius: number;
  shoulderY: number;
  shoulderHalf: number; // half width over the deltoids
  chestY: number;
  waistY: number;
  hipY: number;
  crotchY: number;
  kneeY: number;
  ankleY: number;
  ankleX: number;
  footLength: number;
  footWidth: number;
  hand: Vec3; // right hand centre (x > 0 is mirrored for the left)
}

export interface BodyModel {
  measurements: BodyMeasurements;
  limbs: Limb[];
  anchors: BodyAnchors;
  /** Half width of the body silhouette seen from the front at height y (arms excluded). */
  halfWidthAt: (y: number) => number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Semi-axis `a` of an ellipse with circumference C and depth ratio r = b / a (Ramanujan). */
function semiFromCirc(C: number, r: number) {
  return C / (Math.PI * (3 * (1 + r) - Math.sqrt((3 + r) * (1 + 3 * r))));
}

function ring(c: Vec3, a: number, b: number, n = 2, bumps: [number, number, number, number] = [0, 0, 0, 0]): Ring {
  return { c, a, b, n, bumps };
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** Smoothly interpolates key rings (Catmull-Rom on every parameter). */
function densify(keys: Ring[], steps: number): Ring[] {
  const out: Ring[] = [];
  const get = (i: number) => keys[Math.max(0, Math.min(keys.length - 1, i))];
  for (let i = 0; i < keys.length - 1; i++) {
    const [r0, r1, r2, r3] = [get(i - 1), get(i), get(i + 1), get(i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const f = (k: (r: Ring) => number) => catmull(k(r0), k(r1), k(r2), k(r3), t);
      out.push({
        c: [f((r) => r.c[0]), f((r) => r.c[1]), f((r) => r.c[2])],
        a: Math.max(0.05, f((r) => r.a)),
        b: Math.max(0.05, f((r) => r.b)),
        n: f((r) => r.n),
        bumps: [0, 1, 2, 3].map((k) => Math.max(0, f((r) => r.bumps[k]))) as Ring['bumps'],
      });
    }
  }
  out.push(keys[keys.length - 1]);
  return out;
}

/** Radius of the cross-section at angle theta (superellipse + gaussian bumps). */
export function ringRadius(r: Ring, theta: number) {
  const c = Math.abs(Math.cos(theta)) / r.a;
  const s = Math.abs(Math.sin(theta)) / r.b;
  let rad = Math.pow(Math.pow(c, r.n) + Math.pow(s, r.n), -1 / r.n);
  for (let k = 0; k < 4; k++) {
    if (!r.bumps[k]) continue;
    let d = theta - BUMP_ANGLES[k];
    d = Math.atan2(Math.sin(d), Math.cos(d));
    rad += r.bumps[k] * Math.exp(-((d / BUMP_WIDTHS[k]) ** 2));
  }
  return rad;
}

export function buildBody(m: BodyMeasurements): BodyModel {
  const F = m.base === 'female';
  const H = m.height;
  const crotchY = m.legLength;
  const U = H - crotchY; // crotch → top of head
  const headH = 0.125 * H;
  const headTop = H;
  const chinY = H - headH;
  const shoulderY = crotchY + 0.645 * U;
  const neckBaseY = shoulderY + 0.025 * H;

  // ---------- Torso ----------
  const rHip = F ? 0.66 : 0.66;
  const hipA = semiFromCirc(m.hips * 0.95, rHip);
  const rWaist = F ? 0.72 : 0.78;
  const waistA = semiFromCirc(m.waist, rWaist);
  const underbustC = F ? m.chest * 0.82 : m.chest * 0.95;
  const chestA = semiFromCirc(F ? m.chest * 0.88 : m.chest * 0.96, 0.66);
  const underA = semiFromCirc(underbustC, 0.7);
  const bust = F ? (m.chest - underbustC) * 0.24 : 1.1;
  const glute = F ? 2.3 : 1.7;
  const S = m.shoulders;
  const armR = m.arm / (2 * Math.PI);
  const neckR = m.neck / (2 * Math.PI);

  const y = (f: number) => crotchY + f * U;
  const torsoKeys: Ring[] = [
    ring([0, crotchY - 7, -0.5], 1, 1, 2),
    ring([0, crotchY - 5.5, -0.6], hipA * 0.55, hipA * 0.38, 2.2),
    ring([0, crotchY - 3, -0.8], hipA * 0.84, hipA * 0.46, 2.3, [0, 0, glute * 0.3, glute * 0.3]),
    ring([0, y(0.02), -1.4], hipA * 0.93, hipA * rHip * 0.88, 2.3, [0, 0, glute * 0.8, glute * 0.8]),
    ring([0, y(0.1), -1.4], hipA, hipA * rHip, 2.3, [0, 0, glute, glute]),
    ring([0, y(0.19), -0.8], lerp(waistA, hipA, 0.55), lerp(waistA * rWaist, hipA * rHip, 0.55), 2.2, [0, 0, glute * 0.3, glute * 0.3]),
    ring([0, y(0.285), 0], waistA, waistA * rWaist, 2.2),
    ring([0, y(0.4), 0.3], underA, underA * 0.7, 2.2, [bust * 0.5, bust * 0.5, 0, 0]),
    ring([0, y(0.44), 0.4], lerp(underA, chestA, 0.6), lerp(underA * 0.7, chestA * 0.66, 0.6), 2.25, [bust * 0.95, bust * 0.95, 0, 0]),
    ring([0, y(0.48), 0.4], chestA, chestA * 0.66, 2.3, [bust, bust, 0, 0]),
    ring([0, y(0.535), 0.1], Math.max(chestA * 1.02, S / 2 - armR * 1.25), chestA * 0.62, 2.35, [bust * 0.45, bust * 0.45, 0, 0]),
    ring([0, shoulderY - 2, -0.6], S / 2 - armR * 0.55, chestA * 0.5, 2.35),
    ring([0, shoulderY + 0.8, -0.9], S * 0.33, chestA * 0.42, 2.2),
    ring([0, shoulderY + 2.6, -1.1], S * 0.21, Math.min(chestA * 0.36, neckR * 1.2), 2.2),
    ring([0, neckBaseY - 0.6, -1], neckR * 1.18, neckR * 1.05, 2),
    ring([0, neckBaseY + 0.8, -0.9], neckR * 0.88, neckR * 0.84, 2),
  ];
  const torso = densify(torsoKeys, 6);
  const torsoParts: BodyPartId[] = torso.map((r) => {
    const ry = r.c[1];
    if (ry < y(0.2)) return 'hips';
    if (ry < y(0.36)) return 'waist';
    if (ry < y(0.56)) return 'chest';
    if (ry < neckBaseY - 0.5) return 'shoulders';
    return 'neck';
  });

  // ---------- Neck ----------
  const neck = densify(
    [
      ring([0, shoulderY - 2, -1], neckR * 1.05, neckR, 2),
      ring([0, neckBaseY + 1, -0.6], neckR, neckR * 0.95, 2),
      ring([0, chinY + 1, 0.8], neckR * 0.95, neckR * 0.92, 2),
      ring([0, chinY + 5, 1.6], neckR * 0.9, neckR * 0.9, 2),
      ring([0, chinY + 8, 2.2], neckR * 0.6, neckR * 0.6, 2),
    ],
    4,
  );

  // ---------- Head ----------
  const hw = 0.0445 * H;
  const hd = 0.059 * H;
  const hy = (t: number) => lerp(chinY - 0.6, headTop, t);
  const hz = hd * 0.22; // the skull sits forward of the neck
  const head = densify(
    [
      ring([0, hy(0), hd * 0.42 + hz], hw * 0.22, hd * 0.18, 2),
      ring([0, hy(0.06), hd * 0.36 + hz], hw * 0.48, hd * 0.42, 2),
      ring([0, hy(0.18), hd * 0.2 + hz], hw * 0.72, hd * 0.72, 2.1),
      ring([0, hy(0.34), hd * 0.08 + hz], hw * 0.88, hd * 0.9, 2.2),
      ring([0, hy(0.52), hz], hw * 0.97, hd * 0.98, 2.2),
      ring([0, hy(0.7), -hd * 0.04 + hz], hw, hd, 2.1),
      ring([0, hy(0.86), -hd * 0.06 + hz], hw * 0.86, hd * 0.86, 2),
      ring([0, hy(0.96), -hd * 0.08 + hz], hw * 0.52, hd * 0.55, 2),
      ring([0, headTop, -hd * 0.1 + hz], 0.3, 0.3, 2),
    ],
    5,
  );

  // ---------- Arms ----------
  const Lu = 0.172 * H;
  const Lf = 0.157 * H;
  const Lh = 0.108 * H;
  const abd = (7 * Math.PI) / 180;
  const arm = (side: 1 | -1): Ring[] => {
    const J: Vec3 = [side * (S / 2 - armR * 0.45), shoulderY - armR * 0.7, -0.6];
    const at = (s: number, a: number, b: number, n = 2): Ring => {
      const bend = s > Lu ? (s - Lu) * 0.07 : 0;
      return ring([J[0] + side * Math.sin(abd) * s, J[1] - Math.cos(abd) * s, J[2] + bend], a, b, n);
    };
    return densify(
      [
        at(-armR * 0.95, armR * 0.3, armR * 0.3),
        at(-armR * 0.45, armR * 0.95, armR * 1.0),
        at(Lu * 0.15, armR * 1.12, armR * 1.05),
        at(Lu * 0.45, armR * 0.98, armR * 0.95),
        at(Lu * 0.85, armR * 0.78, armR * 0.76),
        at(Lu, armR * 0.72, armR * 0.7),
        at(Lu + Lf * 0.25, armR * 0.8, armR * 0.74),
        at(Lu + Lf * 0.75, armR * 0.55, armR * 0.5),
        at(Lu + Lf, 0.0105 * H, 0.016 * H),
        at(Lu + Lf + Lh * 0.35, 0.012 * H, 0.0235 * H, 2.3),
        at(Lu + Lf + Lh * 0.55, 0.0105 * H, 0.022 * H, 2.3),
        at(Lu + Lf + Lh * 0.8, 0.008 * H, 0.0175 * H, 2.1),
        at(Lu + Lf + Lh * 0.97, 0.005 * H, 0.01 * H),
        at(Lu + Lf + Lh, 0.1, 0.1),
      ],
      5,
    );
  };
  const rightArm = arm(1);
  const handRing = rightArm[Math.round(rightArm.length * 0.9)];

  // ---------- Legs ----------
  const thighR = m.thigh / (2 * Math.PI);
  const calfR = m.calf / (2 * Math.PI);
  const kneeY = 0.62 * crotchY;
  const calfY = 0.42 * crotchY;
  const ankleY = 0.075 * crotchY;
  const hipX = Math.max(thighR * 0.95, hipA - thighR);
  const kneeR = Math.max(thighR * 0.58, calfR * 0.95);
  const kneeX = Math.max(kneeR + 0.4, hipX * 0.62);
  const ankleX = kneeX + 0.6;
  const leg = (side: 1 | -1): Ring[] => {
    const at = (yy: number, x: number, a: number, b: number, z = 0) => ring([side * x, yy, z], a, b, 2);
    const k = (t: number) => lerp(crotchY, kneeY, t);
    const c = (t: number) => lerp(kneeY, ankleY, t);
    return densify(
      [
        at(y(0.12), hipX * 0.9, thighR * 0.85, thighR * 0.85),
        at(y(0.02), hipX, thighR * 1.05, thighR, -0.3),
        at(k(0.12), lerp(hipX, kneeX, 0.12), thighR, thighR * 0.97, 0),
        at(k(0.5), lerp(hipX, kneeX, 0.5), thighR * 0.86, thighR * 0.84, 0.3),
        at(k(0.85), lerp(hipX, kneeX, 0.85), thighR * 0.66, thighR * 0.64, 0.4),
        at(kneeY, kneeX, kneeR, kneeR, 0.6),
        at(c(0.12), lerp(kneeX, ankleX, 0.12), calfR * 0.9, calfR * 0.95, -0.2),
        at(calfY, lerp(kneeX, ankleX, (kneeY - calfY) / (kneeY - ankleY)), calfR * 0.95, calfR * 1.05, -0.8),
        at(c(0.7), lerp(kneeX, ankleX, 0.7), calfR * 0.62, calfR * 0.62, -0.3),
        at(ankleY + 2.2, ankleX, calfR * 0.42, calfR * 0.46, -0.2),
        at(ankleY, ankleX, calfR * 0.46, calfR * 0.5, -0.4),
        at(ankleY - 3, ankleX, calfR * 0.4, calfR * 0.45, -0.6),
      ],
      6,
    );
  };
  const rightLeg = leg(1);
  const legParts: BodyPartId[] = rightLeg.map((r) => (r.c[1] > kneeY + 2 ? 'thighs' : 'calves'));

  // ---------- Feet (lofted front-to-back, cross-sections in the xy plane) ----------
  const FL = 0.152 * H;
  const FW = 0.058 * H;
  const foot = (side: 1 | -1): Ring[] => {
    const at = (zf: number, a: number, b: number) => {
      const z = zf * FL;
      return ring([side * (ankleX + z * 0.12), b, z - 0.6], a, b, 2.6);
    };
    return densify(
      [
        at(-0.22, FW * 0.12, 1.6),
        at(-0.17, FW * 0.33, ankleY * 0.5),
        at(0, FW * 0.37, ankleY * 0.85),
        at(0.3, FW * 0.43, ankleY * 0.55),
        at(0.55, FW * 0.5, 2.3),
        at(0.72, FW * 0.48, 1.7),
        at(0.8, FW * 0.3, 1.2),
        at(0.815, 0.15, 0.15),
      ],
      5,
    );
  };

  const mirror = (rings: Ring[]): Ring[] => rings.map((r) => ({ ...r, c: [-r.c[0], r.c[1], r.c[2]] }));

  const limbs: Limb[] = [
    { part: 'chest', plane: 'xz', radial: 56, rings: torso, ringParts: torsoParts },
    { part: 'neck', plane: 'xz', radial: 32, rings: neck },
    { part: 'head', plane: 'xz', radial: 48, rings: head },
    { part: 'arms', plane: 'xz', radial: 28, rings: rightArm },
    { part: 'arms', plane: 'xz', radial: 28, rings: mirror(rightArm) },
    { part: 'thighs', plane: 'xz', radial: 36, rings: rightLeg, ringParts: legParts },
    { part: 'thighs', plane: 'xz', radial: 36, rings: mirror(rightLeg), ringParts: legParts },
    { part: 'feet', plane: 'xy', radial: 28, rings: foot(1) },
    { part: 'feet', plane: 'xy', radial: 28, rings: foot(-1) },
  ];

  // Front silhouette (torso above the crotch, outer edge of the legs below).
  const torsoSamples = torso.filter((r) => r.a > 2).map((r) => [r.c[1], ringRadius(r, 0)] as const);
  const legSamples = rightLeg.map((r) => [r.c[1], r.c[0] + ringRadius(r, 0)] as const);
  const sampleAt = (samples: readonly (readonly [number, number])[], yy: number) => {
    const sorted = [...samples].sort((p, q) => p[0] - q[0]);
    if (yy <= sorted[0][0]) return sorted[0][1];
    for (let i = 1; i < sorted.length; i++) {
      if (yy <= sorted[i][0]) {
        const [y0, v0] = sorted[i - 1];
        const [y1, v1] = sorted[i];
        return lerp(v0, v1, (yy - y0) / (y1 - y0 || 1));
      }
    }
    return sorted[sorted.length - 1][1];
  };
  const halfWidthAt = (yy: number) =>
    yy >= crotchY ? Math.max(sampleAt(torsoSamples, yy), yy < y(0.12) ? sampleAt(legSamples, yy) : 0) : sampleAt(legSamples, yy);

  return {
    measurements: m,
    limbs,
    halfWidthAt,
    anchors: {
      height: H,
      headTop,
      chinY,
      headCenter: [0, hy(0.5), hd * 0.3],
      headHalfWidth: hw,
      headHalfHeight: (headTop - chinY) / 2,
      neckRadius: neckR,
      shoulderY,
      shoulderHalf: S / 2 + armR * 0.55,
      chestY: y(0.47),
      waistY: y(0.285),
      hipY: y(0.1),
      crotchY,
      kneeY,
      ankleY,
      ankleX,
      footLength: FL,
      footWidth: FW,
      hand: handRing.c,
    },
  };
}

/** Reference body for a base shape: garments are assumed to be photographed on it. */
const refCache = new Map<string, BodyModel>();
export function referenceBody(base: BodyMeasurements['base']): BodyModel {
  let ref = refCache.get(base);
  if (!ref) {
    ref = buildBody(DEFAULT_BODY[base]);
    refCache.set(base, ref);
  }
  return ref;
}
