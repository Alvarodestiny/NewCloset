import { Category } from './types';

export interface ShopResult {
  title: string;
  url: string;
}

export interface AiIdentification {
  name: string;
  category: Category;
  color: string;
  brandGuess: string | null;
  searchQuery: string;
  results: ShopResult[];
}

const API_URL = process.env.EXPO_PUBLIC_API_URL;

/**
 * Sends a garment photo to the NewCloset backend (see /server), which asks
 * Claude to identify it and search the web for shops selling it.
 * The Anthropic API key lives only on the server, never in the app.
 */
export async function identifyGarment(base64: string, mediaType: string): Promise<AiIdentification> {
  if (!API_URL) {
    throw new Error('Falta EXPO_PUBLIC_API_URL: arranca el servidor de /server y configura la URL en .env');
  }
  const res = await fetch(`${API_URL}/identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64, mediaType }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error del servidor (${res.status})`);
  }
  return res.json();
}
