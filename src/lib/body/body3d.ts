import * as THREE from 'three';
import { BodyPartId } from './measurements';
import { BodyModel, Limb, ringRadius } from './model';

export type Highlight = BodyPartId | 'all' | 'legs' | null;

const PART_INDEX: BodyPartId[] = ['head', 'neck', 'shoulders', 'chest', 'waist', 'hips', 'arms', 'thighs', 'calves', 'feet'];

function loftLimb(limb: Limb) {
  const { rings, radial, plane } = limb;
  const positions: number[] = [];
  const parts: number[] = [];
  const indices: number[] = [];

  rings.forEach((r, i) => {
    const part = PART_INDEX.indexOf(limb.ringParts?.[i] ?? limb.part);
    for (let j = 0; j < radial; j++) {
      const th = (j / radial) * Math.PI * 2;
      const rad = ringRadius(r, th);
      const u = Math.cos(th) * rad;
      const v = Math.sin(th) * rad;
      if (plane === 'xz') positions.push(r.c[0] + u, r.c[1], r.c[2] + v);
      else positions.push(r.c[0] + u, r.c[1] + v, r.c[2]);
      parts.push(part);
    }
  });
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      indices.push(a, c, b, b, c, d);
    }
  }
  // End caps (fan around the ring centre).
  for (const [ri, flip] of [[0, true], [rings.length - 1, false]] as const) {
    const center = positions.length / 3;
    const r = rings[ri];
    positions.push(...r.c);
    parts.push(parts[ri * radial]);
    for (let j = 0; j < radial; j++) {
      const a = ri * radial + j;
      const b = ri * radial + ((j + 1) % radial);
      if (flip) indices.push(center, a, b);
      else indices.push(center, b, a);
    }
  }

  // Make sure triangles face outwards (signed volume must be positive).
  let vol = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const [p, q, s] = [indices[t], indices[t + 1], indices[t + 2]].map((k) => new THREE.Vector3(positions[k * 3], positions[k * 3 + 1], positions[k * 3 + 2]));
    vol += p.dot(q.clone().cross(s));
  }
  if (vol < 0) {
    for (let t = 0; t < indices.length; t += 3) [indices[t + 1], indices[t + 2]] = [indices[t + 2], indices[t + 1]];
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return { geo, parts };
}

/** One merged geometry for the whole body + the part id of every vertex (for highlighting). */
export function buildBodyGeometry(model: BodyModel) {
  const pieces = model.limbs.map(loftLimb);
  const total = pieces.reduce((n, p) => n + p.geo.attributes.position.count, 0);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const parts = new Uint8Array(total);
  const idx: number[] = [];
  let offset = 0;
  for (const p of pieces) {
    const count = p.geo.attributes.position.count;
    pos.set(p.geo.attributes.position.array as Float32Array, offset * 3);
    nor.set(p.geo.attributes.normal.array as Float32Array, offset * 3);
    parts.set(p.parts, offset);
    const index = p.geo.index!.array;
    for (let i = 0; i < index.length; i++) idx.push(index[i] + offset);
    offset += count;
    p.geo.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return { geo, parts };
}

const LEG_PARTS = new Set(['thighs', 'calves', 'feet', 'hips']);

export function paintBody(geo: THREE.BufferGeometry, parts: Uint8Array, skin: string, highlight: Highlight) {
  const base = new THREE.Color(skin);
  const hi = base.clone().lerp(new THREE.Color('#C8A15A'), 0.55);
  const col = geo.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < parts.length; i++) {
    const part = PART_INDEX[parts[i]];
    const on = highlight === 'all' || (highlight === 'legs' ? LEG_PARTS.has(part) : highlight === part);
    const c = on && highlight !== 'all' ? hi : base;
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}

export function partCenterY(model: BodyModel, part: Highlight): number {
  const a = model.anchors;
  switch (part) {
    case 'head': return (a.headTop + a.chinY) / 2;
    case 'neck': return a.chinY - 3;
    case 'shoulders': return a.shoulderY;
    case 'chest': return a.chestY;
    case 'waist': return a.waistY;
    case 'hips': return a.hipY;
    case 'arms': return (a.shoulderY + a.hand[1]) / 2;
    case 'thighs': return (a.crotchY + a.kneeY) / 2;
    case 'calves': return (a.kneeY + a.ankleY) / 2;
    case 'feet': return 6;
    case 'legs': return a.crotchY / 2;
    default: return a.height / 2;
  }
}
