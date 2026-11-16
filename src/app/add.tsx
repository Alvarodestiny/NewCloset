import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { GarmentDraft, GarmentForm } from '../components/GarmentForm';
import { AiIdentification, identifyGarment } from '../lib/ai';
import { persistPhoto } from '../lib/images';
import { extractUrl, importFromUrl } from '../lib/importer';
import { useStore } from '../lib/store';
import { colors } from '../lib/theme';
import { Category } from '../lib/types';

type Mode = 'link' | 'photo' | 'manual';

export default function AddGarment() {
  const params = useLocalSearchParams<{ category?: Category; url?: string }>();
  const store = useStore();
  const [mode, setMode] = useState<Mode>('link');
  const [url, setUrl] = useState(params.url ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<GarmentDraft | null>(null);
  const [ai, setAi] = useState<(AiIdentification & { photoUri: string }) | null>(null);

  const empty: GarmentDraft = { name: '', category: params.category ?? 'top' };

  useEffect(() => {
    if (!store.canAddGarment) router.replace('/paywall');
  }, [store.canAddGarment]);

  const importLink = async (value = url) => {
    const link = extractUrl(value);
    if (!link) return setError('Pega un enlace válido (https://…)');
    setError(null);
    setLoading(true);
    try {
      const p = await importFromUrl(link);
      setDraft({ name: p.name, category: p.category, imageUrl: p.imageUrl, brand: p.brand, price: p.price, sourceUrl: p.sourceUrl });
    } catch (e) {
      setError(
        Platform.OS === 'web'
          ? 'En la versión web el navegador bloquea la descarga (CORS). Pruébalo en el móvil o añádela a mano.'
          : `No pudimos leer esa página (${(e as Error).message}). Puedes añadirla a mano.`,
      );
      setDraft({ ...empty, sourceUrl: link });
    } finally {
      setLoading(false);
    }
  };

  const paste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setUrl(text);
      importLink(text);
    }
  };

  const scanPhoto = async (camera: boolean) => {
    if (!store.canUseAi) return router.push('/paywall');
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: true, allowsEditing: true };
    if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return;
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0].base64) return;
    const asset = res.assets[0];
    setError(null);
    setLoading(true);
    try {
      const result = await identifyGarment(asset.base64!, asset.mimeType ?? 'image/jpeg');
      store.updateProfile({ aiScansUsed: store.profile.aiScansUsed + 1 });
      setAi({ ...result, photoUri: asset.uri });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const useOwnPhoto = async () => {
    if (!ai) return;
    setDraft({ name: ai.name, category: ai.category, color: ai.color, brand: ai.brandGuess ?? undefined, imageUrl: await persistPhoto(ai.photoUri) });
  };

  const save = (g: GarmentDraft) => {
    const saved = store.addGarment(g);
    store.wear(saved.category, saved.id);
    router.dismissTo('/');
  };

  if (draft) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {error && <Text style={styles.error}>{error}</Text>}
          <GarmentForm initial={draft} submitLabel="Guardar en mi armario" onSubmit={save} />
          <Button title="Atrás" variant="secondary" onPress={() => setDraft(null)} style={{ marginTop: 10 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.tabs}>
        {([['link', '🔗 Enlace'], ['photo', '✨ Foto IA'], ['manual', '✏️ Manual']] as const).map(([m, label]) => (
          <Pressable key={m} onPress={() => setMode(m)} style={[styles.tab, mode === m && styles.tabActive]}>
            <Text style={[styles.tabText, mode === m && { color: '#fff' }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {mode === 'link' && (
        <View>
          <Text style={styles.title}>Importa desde cualquier tienda</Text>
          <Text style={styles.help}>Copia el enlace de la prenda (Zara, Mango, Shein, Asos, Pull&Bear…) y pégalo aquí. Sacamos la foto, nombre, marca y precio.</Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://www.tienda.com/producto…"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
            onSubmitEditing={() => importLink()}
          />
          <View style={styles.row}>
            <Button title="Pegar" variant="secondary" onPress={paste} style={styles.flex} />
            <Button title="Importar" onPress={() => importLink()} loading={loading} style={styles.flex} />
          </View>
        </View>
      )}

      {mode === 'photo' && (
        <View>
          <Text style={styles.title}>Hazle una foto y la IA la encuentra <Text style={styles.badge}> PREMIUM </Text></Text>
          <Text style={styles.help}>
            Fotografía una prenda (tuya o que hayas visto) y la identificamos y buscamos en tiendas online.
            {!store.profile.isPremium && `\nTe quedan ${Math.max(0, 1 - store.profile.aiScansUsed)} búsqueda(s) de prueba.`}
          </Text>
          {!ai && (
            <View style={styles.row}>
              <Button title="📷 Cámara" onPress={() => scanPhoto(true)} loading={loading} style={styles.flex} />
              <Button title="🖼️ Galería" variant="secondary" onPress={() => scanPhoto(false)} disabled={loading} style={styles.flex} />
            </View>
          )}
          {ai && (
            <View style={styles.aiBox}>
              <Text style={styles.aiName}>{ai.name}</Text>
              <Text style={styles.help}>{[ai.color, ai.brandGuess].filter(Boolean).join(' · ')}</Text>
              <Button title="Usar mi foto" variant="secondary" onPress={useOwnPhoto} style={{ marginBottom: 12 }} />
              <Text style={styles.label}>Encontrado en tiendas:</Text>
              {ai.results.length === 0 && <Text style={styles.help}>No encontramos coincidencias exactas.</Text>}
              {ai.results.map((r) => (
                <Pressable key={r.url} style={styles.result} onPress={() => { setUrl(r.url); importLink(r.url); }}>
                  <Text style={styles.resultTitle} numberOfLines={2}>{r.title}</Text>
                  <Text style={styles.resultUrl} numberOfLines={1}>{r.url.replace(/^https?:\/\/(www\.)?/, '')}</Text>
                </Pressable>
              ))}
              <Button title="Otra foto" variant="secondary" onPress={() => setAi(null)} style={{ marginTop: 10 }} />
            </View>
          )}
          {!store.profile.isPremium && <Button title="Desbloquear Premium" variant="gold" onPress={() => router.push('/paywall')} style={{ marginTop: 14 }} />}
        </View>
      )}

      {mode === 'manual' && <GarmentForm initial={empty} submitLabel="Guardar en mi armario" onSubmit={save} />}

      {error && !draft && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 60 },
  tabs: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 22, padding: 4, borderWidth: 1, borderColor: colors.border, marginBottom: 18 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 18, alignItems: 'center' },
  tabActive: { backgroundColor: colors.accent },
  tabText: { fontWeight: '700', color: colors.text },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  badge: { fontSize: 11, color: '#fff', backgroundColor: colors.gold, fontWeight: '800' },
  help: { color: colors.muted, marginTop: 6, marginBottom: 14, lineHeight: 20 },
  input: { height: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 14, color: colors.text, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  error: { color: colors.danger, marginTop: 14, marginBottom: 6 },
  aiBox: { backgroundColor: colors.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.border },
  aiName: { fontSize: 18, fontWeight: '800', color: colors.text },
  label: { fontWeight: '700', color: colors.text, marginBottom: 8 },
  result: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  resultTitle: { color: colors.text, fontWeight: '600' },
  resultUrl: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
