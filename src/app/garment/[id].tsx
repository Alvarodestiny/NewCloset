import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Platform, ScrollView } from 'react-native';
import { Button } from '../../components/Button';
import { GarmentForm } from '../../components/GarmentForm';
import { useStore } from '../../lib/store';

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
      <GarmentForm
        initial={garment}
        submitLabel="Guardar cambios"
        onSubmit={(g) => {
          store.updateGarment({ ...garment, ...g });
          router.back();
        }}
      />
      <Button title="Ponérsela al maniquí" variant="secondary" onPress={() => { store.wear(garment.category, garment.id); router.navigate('/'); }} style={{ marginTop: 10 }} />
      {garment.sourceUrl && <Button title="Ver en la tienda" variant="secondary" onPress={() => Linking.openURL(garment.sourceUrl!)} style={{ marginTop: 10 }} />}
      <Button title="Eliminar" variant="secondary" onPress={remove} style={{ marginTop: 10 }} />
    </ScrollView>
  );
}
