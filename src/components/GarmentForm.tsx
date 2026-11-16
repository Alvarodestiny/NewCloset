import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { resolveImage } from '../lib/images';
import { colors } from '../lib/theme';
import { CATEGORIES, Garment } from '../lib/types';
import { Button } from './Button';

export type GarmentDraft = Omit<Garment, 'id' | 'createdAt'>;

export function GarmentForm({ initial, submitLabel, onSubmit }: {
  initial: GarmentDraft;
  submitLabel: string;
  onSubmit: (g: GarmentDraft) => void;
}) {
  const [draft, setDraft] = useState<GarmentDraft>(initial);
  const set = <K extends keyof GarmentDraft>(k: K, v: GarmentDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <View>
      {draft.imageUrl ? (
        <Image source={{ uri: resolveImage(draft.imageUrl) }} style={styles.image} contentFit="contain" />
      ) : null}

      <Text style={styles.label}>Nombre</Text>
      <TextInput value={draft.name} onChangeText={(v) => set('name', v)} style={styles.input} placeholder="Camiseta blanca básica" placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Categoría</Text>
      <View style={styles.cats}>
        {CATEGORIES.map((c) => (
          <Pressable key={c.key} onPress={() => set('category', c.key)} style={[styles.cat, draft.category === c.key && styles.catActive]}>
            <Text style={[styles.catText, draft.category === c.key && { color: '#fff' }]}>{c.emoji} {c.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>Marca</Text>
          <TextInput value={draft.brand ?? ''} onChangeText={(v) => set('brand', v || undefined)} style={styles.input} placeholderTextColor={colors.muted} placeholder="—" />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>Precio</Text>
          <TextInput value={draft.price ?? ''} onChangeText={(v) => set('price', v || undefined)} style={styles.input} placeholderTextColor={colors.muted} placeholder="—" />
        </View>
      </View>

      <Text style={styles.label}>URL de la imagen</Text>
      <TextInput
        value={draft.imageUrl?.startsWith('local:') ? '(foto de tu móvil)' : draft.imageUrl ?? ''}
        editable={!draft.imageUrl?.startsWith('local:')}
        onChangeText={(v) => set('imageUrl', v || undefined)}
        style={styles.input}
        autoCapitalize="none"
        placeholder="https://…"
        placeholderTextColor={colors.muted}
      />

      <Button title={submitLabel} onPress={() => onSubmit({ ...draft, name: draft.name.trim() || 'Prenda' })} style={{ marginTop: 20 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: 260, borderRadius: 16, backgroundColor: '#F2EEE8', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted, marginTop: 14, marginBottom: 6 },
  input: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 12, color: colors.text },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cat: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  catActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  catText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
