import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { GarmentCard } from '../../components/GarmentCard';
import { useStore } from '../../lib/store';
import { isSpacer, padGrid } from '../../lib/grid';
import { colors } from '../../lib/theme';
import { CATEGORIES, Slot } from '../../lib/types';

export default function PickGarment() {
  const { slot } = useLocalSearchParams<{ slot: Slot }>();
  const store = useStore();
  const items = store.garments.filter((g) => g.category === slot);
  const current = store.current[slot];
  const cat = CATEGORIES.find((c) => c.key === slot);

  const choose = (id?: string) => {
    store.wear(slot, id);
    router.back();
  };

  return (
    <FlatList
      data={padGrid(items)}
      numColumns={2}
      keyExtractor={(g) => g.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<Text style={styles.title}>{cat?.emoji} {cat?.label}</Text>}
      renderItem={({ item }) => isSpacer(item) ? <View style={{ flex: 1, margin: 6 }} /> : <GarmentCard garment={item} selected={item.id === current} onPress={() => choose(item.id)} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No tienes prendas de esta categoría todavía.</Text>
        </View>
      }
      ListFooterComponent={
        <View style={{ gap: 10, marginTop: 12 }}>
          <Button title="+ Añadir prenda" onPress={() => router.replace({ pathname: '/add', params: { category: slot } })} />
          {current && <Button title="Quitar del maniquí" variant="secondary" onPress={() => choose(undefined)} />}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 10, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, margin: 6 },
  empty: { padding: 30, alignItems: 'center' },
  emptyText: { color: colors.muted, textAlign: 'center' },
});
