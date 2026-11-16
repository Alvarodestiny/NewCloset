import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const PREFIX = 'local:';

/**
 * Copies a picked photo into the app's documents folder so it survives cache
 * cleanup. Stored as "local:<name>" because the absolute iOS container path
 * changes between app updates.
 */
export async function persistPhoto(tempUri: string): Promise<string> {
  if (Platform.OS === 'web') return tempUri;
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true });
  const ext = tempUri.split('.').pop()?.split('?')[0] || 'jpg';
  const name = `${randomUUID()}.${ext}`;
  await new File(tempUri).copy(new File(dir, name));
  return `${PREFIX}${name}`;
}

export function resolveImage(uri?: string): string | undefined {
  if (!uri) return undefined;
  if (!uri.startsWith(PREFIX)) return uri;
  return new File(new Directory(Paths.document, 'photos'), uri.slice(PREFIX.length)).uri;
}
