import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Button } from '../../components/Button';
import { Mannequin } from '../../components/Mannequin';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { Slot } from '../../lib/types';

export default function FittingRoom() {
  const store = useStore();
  const { width } = useWindowDimensions();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const mannequinWidth = Math.min(width - 80, 300);
  const worn = Object.values(store.current).filter(Boolean).length;

  const openSlot = (slot: Slot) => router.push({ pathname: '/pick/[slot]', params: { slot } });

  const shuffle = () => {
    const pick = (cat: string) => {
      const list = store.garments.filter((g) => g.category === cat);
      return list.length ? list[Math.floor(Math.random() * list.length)].id : undefined;
    };
    const useDress = Math.random() < 0.3 && store.garments.some((g) => g.category === 'dress');
    store.setCurrent(
      Object.fromEntries(
        Object.entries({
          top: useDress ? undefined : pick('top'),
          bottom: useDress ? undefined : pick('bottom'),
          dress: useDress ? pick('dress') : undefined,
          shoes: pick('shoes'),
          outerwear: Math.random() < 0.5 ? pick('outerwear') : undefined,
        }).filter(([, v]) => v),
      ),
    );
  };

  const save = () => {
    if (!store.canSaveOutfit) return router.push('/paywall');
    store.saveOutfit(name.trim() || `Look ${store.outfits.length + 1}`);
    setName('');
    setNaming(false);
    if (Platform.OS !== 'web') Alert.alert('Look guardado', 'Lo tienes en la pestaña Looks.');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {store.garments.length === 0 && (
        <Pressable style={styles.banner} onPress={() => router.push('/add')}>
          <Text style={styles.bannerTitle}>Empieza tu armario</Text>
          <Text style={styles.bannerText}>Pega el enlace de una prenda de cualquier tienda y la importamos.</Text>
        </Pressable>
      )}

      <View style={styles.stage}>
        <Mannequin
          width={mannequinWidth}
          slots={store.current}
          garmentById={store.garmentById}
          skinTone={store.profile.skinTone} body={store.profile.body}
          facePhotoUri={store.profile.facePhotoUri}
          onPressSlot={openSlot}
          onPressFace={() => router.push('/profile')}
        />
      </View>

      <Button title="🧍 Configurar maniquí" variant="secondary" onPress={() => router.push('/body')} style={{ marginBottom: 10 }} />
      <View style={styles.row}>
        <Button title="🔀 Aleatorio" variant="secondary" onPress={shuffle} disabled={store.garments.length === 0} style={styles.flex} />
        <Button title="Limpiar" variant="secondary" onPress={() => store.setCurrent({})} disabled={worn === 0} style={styles.flex} />
      </View>

      {naming ? (
        <View style={styles.saveBox}>
          <TextInput
            placeholder="Nombre del look (opcional)"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            style={styles.input}
            autoFocus
            onSubmitEditing={save}
          />
          <Button title="Guardar" onPress={save} />
        </View>
      ) : (
        <Button title="Guardar look" onPress={() => setNaming(true)} disabled={worn === 0} />
      )}
      <Button title="+ Añadir prenda" variant="secondary" onPress={() => router.push('/add')} style={{ marginTop: 10 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  banner: { backgroundColor: colors.accent, borderRadius: 18, padding: 16, marginBottom: 12 },
  bannerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  bannerText: { color: '#E8E2D9', marginTop: 4 },
  stage: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 24, paddingVertical: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  flex: { flex: 1 },
  saveBox: { gap: 10 },
  input: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 14, color: colors.text },
});
