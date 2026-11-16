import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { GarmentForm } from '../../components/GarmentForm';
import { cutoutAvailable } from '../../lib/cutout';
import { resolveImage } from '../../lib/images';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function GarmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const garment = store.garmentById(id);
  if (!garment) return null;

  const remove = () => {
    const doIt = () => {
      store.removeGarment(garment.id);
      router.back();
    };
    if (Platform.OS === 'web') return doIt();
    Alert.alert('Eliminar prenda', '¿Seguro que quieres eliminarla del armario?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: doIt },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <View style={styles.cutoutBox}>
        <Text style={styles.cutoutTitle}>Recorte para el maniquí</Text>
        {garment.cutoutStatus === 'processing' ? (
          <View style={styles.cutoutRow}>
            <ActivityIndicator color={colors.text} />
            <Text style={styles.cutoutText}>Quitando el fondo y detectando la forma…</Text>
          </View>
        ) : garment.cutoutUrl ? (
          <View style={styles.cutoutPreview}>
            <Image source={{ uri: resolveImage(garment.cutoutUrl) }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
          </View>
        ) : (
          <Text style={styles.cutoutText}>
            {garment.cutoutStatus === 'failed'
              ? `No se pudo recortar: ${garment.cutoutError ?? 'error desconocido'}`
              : cutoutAvailable()
                ? 'Esta prenda aún tiene el fondo original.'
                : 'Conecta el servidor (EXPO_PUBLIC_API_URL) para quitar fondos.'}
          </Text>
        )}
        {cutoutAvailable() && garment.imageUrl && garment.cutoutStatus !== 'processing' && (
          <Button
            title={garment.cutoutUrl ? 'Repetir recorte' : '✂️ Quitar fondo'}
            variant={garment.cutoutUrl ? 'secondary' : 'primary'}
            onPress={() => store.processCutout(garment)}
            style={{ marginTop: 10 }}
          />
        )}
      </View>
      <GarmentForm
        initial={garment}
        submitLabel="Guardar cambios"
        onSubmit={(g) => {
          const next = { ...garment, ...g };
          store.updateGarment(next);
          // The cut-out depends on the photo and on the category (which garment to lift out).
          if (g.imageUrl !== garment.imageUrl || g.category !== garment.category) store.processCutout({ ...next, cutoutUrl: garment.cutoutUrl });
          router.back();
        }}
      />
      <Button title="Ponérsela al maniquí" variant="secondary" onPress={() => { store.wear(garment.category, garment.id); router.navigate('/'); }} style={{ marginTop: 10 }} />
      {garment.sourceUrl && <Button title="Ver en la tienda" variant="secondary" onPress={() => Linking.openURL(garment.sourceUrl!)} style={{ marginTop: 10 }} />}
      <Button title="Eliminar" variant="secondary" onPress={remove} style={{ marginTop: 10 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cutoutBox: { backgroundColor: colors.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  cutoutTitle: { fontWeight: '800', color: colors.text, fontSize: 15, marginBottom: 8 },
  cutoutRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  cutoutText: { color: colors.muted },
  cutoutPreview: {
    height: 220,
    borderRadius: 12,
    backgroundColor: '#EFEAE3',
    padding: 10,
  },
});
