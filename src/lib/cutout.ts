import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { resolveImage } from './images';
import { Garment, GarmentFit } from './types';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const cutoutAvailable = () => !!API_URL;

/**
 * Sends the garment photo to the server, which removes the background and
 * measures the garment's shape. The transparent image is stored on the device.
 */
export async function requestCutout(garment: Garment): Promise<{ cutoutUrl: string; fit: GarmentFit }> {
  if (!API_URL) throw new Error('Configura EXPO_PUBLIC_API_URL para quitar fondos');
  if (!garment.imageUrl) throw new Error('La prenda no tiene foto');

  const body: Record<string, string> = { category: garment.category };
  if (garment.imageUrl.startsWith('local:') || garment.imageUrl.startsWith('file:')) {
    body.image = await new File(resolveImage(garment.imageUrl)!).base64();
  } else {
    body.imageUrl = garment.imageUrl;
  }

  const res = await fetch(`${API_URL}/cutout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Error del servidor (${res.status})`);

  const { image, fit } = json as { image: string; fit: GarmentFit };
  if (Platform.OS === 'web') return { cutoutUrl: `data:image/webp;base64,${image}`, fit };

  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true });
  const name = `cutout-${randomUUID()}.webp`;
  const file = new File(dir, name);
  file.create();
  await file.write(image, { encoding: 'base64' });
  return { cutoutUrl: `local:${name}`, fit };
}

export function deleteLocalImage(uri?: string) {
  if (!uri?.startsWith('local:') || Platform.OS === 'web') return;
  try {
    const f = new File(resolveImage(uri)!);
    if (f.exists) f.delete();
  } catch {
    // already gone
  }
}
