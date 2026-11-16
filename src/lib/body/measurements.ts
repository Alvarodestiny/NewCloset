export type BodyBase = 'female' | 'male';

/** All lengths in centimetres; "circumference" values are measured with a tape around the body. */
export interface BodyMeasurements {
  base: BodyBase;
  height: number;
  shoulders: number; // shoulder breadth (acromion to acromion)
  chest: number; // bust / chest circumference
  waist: number; // waist circumference
  hips: number; // hip circumference
  thigh: number; // thigh circumference
  calf: number; // calf circumference
  arm: number; // upper-arm circumference
  neck: number; // neck circumference
  legLength: number; // inseam: crotch to floor
}

export type MeasurementKey = Exclude<keyof BodyMeasurements, 'base'>;

export const DEFAULT_BODY: Record<BodyBase, BodyMeasurements> = {
  female: { base: 'female', height: 168, shoulders: 37, chest: 90, waist: 72, hips: 98, thigh: 56, calf: 36, arm: 28, neck: 33, legLength: 77 },
  male: { base: 'male', height: 178, shoulders: 41, chest: 100, waist: 86, hips: 100, thigh: 56, calf: 38, arm: 32, neck: 39, legLength: 82 },
};

export interface BodyPartControl {
  key: MeasurementKey;
  label: string;
  hint: string;
  min: number;
  max: number;
  /** Mesh part highlighted while this control is selected. */
  part: BodyPartId | 'all' | 'legs';
}

export type BodyPartId = 'head' | 'neck' | 'shoulders' | 'chest' | 'waist' | 'hips' | 'arms' | 'thighs' | 'calves' | 'feet';

export const BODY_CONTROLS: BodyPartControl[] = [
  { key: 'height', label: 'Altura', hint: 'De los pies a la cabeza', min: 140, max: 210, part: 'all' },
  { key: 'shoulders', label: 'Hombros', hint: 'Ancho de hombro a hombro', min: 30, max: 56, part: 'shoulders' },
  { key: 'chest', label: 'Pecho', hint: 'Contorno a la altura del pecho', min: 70, max: 150, part: 'chest' },
  { key: 'waist', label: 'Cintura', hint: 'Contorno en la parte más estrecha', min: 55, max: 150, part: 'waist' },
  { key: 'hips', label: 'Cadera', hint: 'Contorno en la parte más ancha', min: 75, max: 160, part: 'hips' },
  { key: 'thigh', label: 'Muslos', hint: 'Contorno del muslo', min: 38, max: 85, part: 'thighs' },
  { key: 'calf', label: 'Gemelos', hint: 'Contorno de la pantorrilla', min: 26, max: 52, part: 'calves' },
  { key: 'arm', label: 'Brazos', hint: 'Contorno del brazo', min: 20, max: 50, part: 'arms' },
  { key: 'neck', label: 'Cuello', hint: 'Contorno del cuello', min: 26, max: 50, part: 'neck' },
  { key: 'legLength', label: 'Largo de pierna', hint: 'Entrepierna hasta el suelo', min: 60, max: 100, part: 'legs' },
];

export function clampBody(b: BodyMeasurements): BodyMeasurements {
  const out = { ...b };
  for (const c of BODY_CONTROLS) out[c.key] = Math.min(c.max, Math.max(c.min, out[c.key]));
  // Keep leg length plausible for the chosen height.
  out.legLength = Math.min(out.legLength, out.height * 0.56);
  out.legLength = Math.max(out.legLength, out.height * 0.38);
  return out;
}
