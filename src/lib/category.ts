import { Category } from './types';

// Keyword lists in Spanish, English, French, Italian, Portuguese and German.
// Order matters: more specific categories are tested first.
const RULES: [Category, string[]][] = [
  ['dress', ['vestido', 'dress', 'robe', 'mono ', 'jumpsuit', 'romper', 'abito', 'kleid', 'peto']],
  ['outerwear', ['abrigo', 'chaqueta', 'cazadora', 'parka', 'blazer', 'americana', 'gabardina', 'plumífero', 'plumifero', 'jacket', 'coat', 'trench', 'puffer', 'bomber', 'anorak', 'veste', 'manteau', 'giacca', 'cappotto', 'casaco', 'jacke', 'mantel', 'chaleco', 'vest', 'gilet']],
  ['shoes', ['zapato', 'zapatilla', 'deportiva', 'bota', 'botín', 'botin', 'sandalia', 'mocasín', 'mocasin', 'tacón', 'tacon', 'chancla', 'shoe', 'sneaker', 'trainer', 'boot', 'sandal', 'loafer', 'heel', 'chaussure', 'basket', 'scarpa', 'sapato', 'tênis', 'schuh', 'stiefel', 'espadrille', 'alpargata']],
  ['bottom', ['pantalón', 'pantalon', 'vaquero', 'jean', 'falda', 'short', 'bermuda', 'legging', 'jogger', 'chino', 'cargo', 'trouser', 'pant', 'skirt', 'jupe', 'gonna', 'calça', 'saia', 'hose', 'rock ']],
  ['accessory', ['bolso', 'mochila', 'gorra', 'gorro', 'sombrero', 'bufanda', 'cinturón', 'cinturon', 'gafas', 'reloj', 'collar', 'pendiente', 'pulsera', 'anillo', 'cartera', 'bag', 'backpack', 'cap', 'hat', 'beanie', 'scarf', 'belt', 'sunglasses', 'watch', 'necklace', 'earring', 'bracelet', 'ring', 'wallet', 'sac', 'borsa', 'bolsa', 'tasche']],
  ['top', ['camiseta', 'camisa', 'blusa', 'top', 'jersey', 'sudadera', 'polo', 'body', 'cárdigan', 'cardigan', 'punto', 'chaleco', 't-shirt', 'tee', 'shirt', 'blouse', 'sweater', 'sweatshirt', 'hoodie', 'pullover', 'knit', 'tank', 'chemise', 'pull', 'maglia', 'camicia', 'camisola', 'hemd', 'pulli']],
];

function matchText(text: string): Category | undefined {
  // Word-start match, so "ring" doesn't hit "string" and "tee" doesn't hit "steel".
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9áéíóúüñçàèìòùâêîôûäöß]+/g, ' ')} `;
  for (const [category, words] of RULES) {
    if (words.some((w) => haystack.includes(` ${w.trim()}`))) return category;
  }
  return undefined;
}

/** Tries each text in order (most reliable first: product name, then URL, then description). */
export function guessCategory(...texts: (string | undefined)[]): Category {
  for (const t of texts) {
    const found = t ? matchText(t) : undefined;
    if (found) return found;
  }
  return 'top';
}
