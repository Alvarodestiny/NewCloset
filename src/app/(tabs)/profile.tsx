import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Mannequin } from '../../components/Mannequin';
import { persistPhoto } from '../../lib/images';
import { FREE_LIMITS, useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function Profile() {
  const store = useStore();
  const { profile } = store;

  const pickFace = async (camera: boolean) => {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.7 };
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
    }
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled) store.updateProfile({ facePhotoUri: await persistPhoto(res.assets[0].uri) });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.preview}>
        <Mannequin width={140} compact slots={store.current} garmentById={store.garmentById} skinTone={profile.skinTone} body={profile.body} facePhotoUri={profile.facePhotoUri} />
      </View>

      <Text style={styles.section}>Tu cara en el maniquí (opcional)</Text>
      <Text style={styles.help}>Sube un selfie de frente. Se guarda solo en tu móvil.</Text>
      <View style={styles.row}>
        <Button title="📷 Cámara" variant="secondary" onPress={() => pickFace(true)} style={styles.flex} />
        <Button title="🖼️ Galería" variant="secondary" onPress={() => pickFace(false)} style={styles.flex} />
      </View>
      {profile.facePhotoUri && (
        <Button title="Quitar foto" variant="secondary" onPress={() => store.updateProfile({ facePhotoUri: undefined })} style={{ marginTop: 10 }} />
      )}

      <Text style={styles.section}>Tu cuerpo</Text>
      <Text style={styles.help}>Ajusta altura, hombros, pecho, cintura, cadera y más para que la ropa te quede como en la vida real.</Text>
      <Button title="🧍 Configuración de maniquí" onPress={() => router.push('/body')} />

      <Text style={styles.section}>Plan</Text>
      {profile.isPremium ? (
        <View style={styles.premiumCard}>
          <Text style={styles.premiumTitle}>✨ NewCloset Premium activo</Text>
          <Text style={styles.premiumText}>Prendas y looks ilimitados · Búsqueda por foto con IA</Text>
        </View>
      ) : (
        <View style={styles.planCard}>
          <Text style={styles.planText}>
            Plan gratuito: {store.garments.length}/{FREE_LIMITS.garments} prendas · {store.outfits.length}/{FREE_LIMITS.outfits} looks · {Math.max(0, FREE_LIMITS.aiScans - profile.aiScansUsed)} búsqueda IA de prueba
          </Text>
          <Button title="Hazte Premium" variant="gold" onPress={() => router.push('/paywall')} style={{ marginTop: 12 }} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  preview: { alignItems: 'center', marginBottom: 8 },
  section: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 22, marginBottom: 6 },
  help: { color: colors.muted, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  planCard: { backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border },
  planText: { color: colors.text },
  premiumCard: { backgroundColor: colors.accent, borderRadius: 18, padding: 16 },
  premiumTitle: { color: colors.gold, fontWeight: '800', fontSize: 16 },
  premiumText: { color: '#E8E2D9', marginTop: 4 },
});
