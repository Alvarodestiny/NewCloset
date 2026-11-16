export type Category = 'top' | 'bottom' | 'shoes' | 'outerwear' | 'dress' | 'accessory';

export const CATEGORIES: { key: Category; label: string; emoji: string }[] = [
  { key: 'top', label: 'Partes de arriba', emoji: '👕' },
  { key: 'bottom', label: 'Pantalones y faldas', emoji: '👖' },
  { key: 'dress', label: 'Vestidos y monos', emoji: '👗' },
  { key: 'outerwear', label: 'Abrigos y chaquetas', emoji: '🧥' },
  { key: 'shoes', label: 'Calzado', emoji: '👟' },
  { key: 'accessory', label: 'Accesorios', emoji: '👜' },
];

export interface Garment {
  id: string;
  name: string;
  category: Category;
  imageUrl?: string;
  sourceUrl?: string;
  brand?: string;
  price?: string;
  color?: string;
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
  isPremium: boolean;
  aiScansUsed: number;
}
