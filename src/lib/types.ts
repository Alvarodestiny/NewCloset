import { BodyMeasurements } from './body/measurements';

export type Category = 'top' | 'bottom' | 'shoes' | 'outerwear' | 'dress' | 'accessory';

export const CATEGORIES: { key: Category; label: string; emoji: string }[] = [
  { key: 'top', label: 'Partes de arriba', emoji: '👕' },
  { key: 'bottom', label: 'Pantalones y faldas', emoji: '👖' },
  { key: 'dress', label: 'Vestidos y monos', emoji: '👗' },
  { key: 'outerwear', label: 'Abrigos y chaquetas', emoji: '🧥' },
  { key: 'shoes', label: 'Calzado', emoji: '👟' },
  { key: 'accessory', label: 'Accesorios', emoji: '👜' },
];

/** Shape of a background-removed garment (computed by the server, see server/segment.ts). */
export interface GarmentFit {
  aspect: number;
  rows: ([number, number] | null)[];
  pieces: number;
  method: 'cloth' | 'object';
}

export interface Garment {
  id: string;
  name: string;
  category: Category;
  imageUrl?: string;
  sourceUrl?: string;
  brand?: string;
  price?: string;
  color?: string;
  /** Background-removed image ("local:<file>" on device). */
  cutoutUrl?: string;
  fit?: GarmentFit;
  cutoutStatus?: 'processing' | 'done' | 'failed';
  cutoutError?: string;
  createdAt: number;
}

/** Slots shown on the mannequin. `dress` covers top + bottom. */
export type Slot = 'outerwear' | 'top' | 'bottom' | 'dress' | 'shoes' | 'accessory';

export type OutfitSlots = Partial<Record<Slot, string>>; // slot -> garment id

export interface Outfit {
  id: string;
  name: string;
  slots: OutfitSlots;
  createdAt: number;
}

export interface Profile {
  facePhotoUri?: string;
  skinTone: string;
  body: BodyMeasurements;
  isPremium: boolean;
  aiScansUsed: number;
}
