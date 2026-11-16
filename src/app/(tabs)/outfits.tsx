import { router } from 'expo-router';
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Mannequin } from '../../components/Mannequin';
import { FREE_LIMITS, useStore } from '../../lib/store';
import { isSpacer, padGrid } from '../../lib/grid';
import { colors } from '../../lib/theme';
import { Outfit } from '../../lib/types';

export default function Outfits() {
  const store = useStore();

  const confirmDelete = (o: Outfit) => {
    if (Platform.OS === 'web') return store.removeOutfit(o.id);
    Alert.alert('Borrar look', `¿Borrar "${o.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => store.removeOutfit(o.id) },
    ]);
  };

  return (
    <FlatList
      data={padGrid(store.outfits)}
      keyExtractor={(o) => o.id}
      numColumns={2}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        !store.profile.isPremium ? (
          <Text style={styles.limit}>{store.outfits.length}/{FREE_LIMITS.outfits} looks en el plan gratuito</Text>
        ) : undefined
      }
      renderItem={({ item }) => isSpacer(item) ? <View style={{ flex: 1, margin: 6 }} /> : (
        <Pressable
          style={styles.card}
          onPress={() => {
            store.setCurrent(item.slots);
            router.navigate('/');
          }}
          onLongPress={() => confirmDelete(item)}
        >
          <Mannequin width={120} compact slots={item.slots} garmentById={store.garmentById} skinTone={store.profile.skinTone} facePhotoUri={store.profile.facePhotoUri} />
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        </Pressable>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🪞</Text>
          <Text style={styles.emptyText}>Viste el maniquí en el Probador y guarda tus looks favoritos.</Text>
        </View>
      }
      ListFooterComponent={store.outfits.length ? <Text style={styles.hint}>Toca para probar · Mantén pulsado para borrar</Text> : undefined}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 10, paddingBottom: 40 },
  limit: { color: colors.muted, fontSize: 12, padding: 6 },
  card: { flex: 1, margin: 6, alignItems: 'center', backgroundColor: colors.card, borderRadius: 18, paddingVertical: 12, borderWidth: 1, borderColor: colors.border },
  name: { marginTop: 6, fontWeight: '700', color: colors.text },
  empty: { alignItems: 'center', padding: 40 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: colors.muted, marginTop: 8, textAlign: 'center' },
  hint: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 10 },
});
