import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { GarmentCard } from '../../components/GarmentCard';
import { FREE_LIMITS, useStore } from '../../lib/store';
import { isSpacer, padGrid } from '../../lib/grid';
import { colors } from '../../lib/theme';
import { CATEGORIES, Category } from '../../lib/types';

export default function Wardrobe() {
  const { garments, profile } = useStore();
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const data = useMemo(() => (filter === 'all' ? garments : garments.filter((g) => g.category === filter)), [garments, filter]);

  return (
    <View style={styles.flex}>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[{ key: 'all' as const, label: 'Todo', emoji: '✨' }, ...CATEGORIES].map((c) => (
            <Pressable key={c.key} onPress={() => setFilter(c.key)} style={[styles.chip, filter === c.key && styles.chipActive]}>
              <Text style={[styles.chipText, filter === c.key && styles.chipTextActive]}>{c.emoji} {c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {!profile.isPremium && (
        <Text style={styles.limit}>{garments.length}/{FREE_LIMITS.garments} prendas en el plan gratuito</Text>
      )}
      <FlatList
        data={padGrid(data)}
        keyExtractor={(g) => g.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => isSpacer(item) ? <View style={{ flex: 1, margin: 6 }} /> : (
          <GarmentCard garment={item} onPress={() => router.push({ pathname: '/garment/[id]', params: { id: item.id } })} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🧺</Text>
            <Text style={styles.emptyText}>Aún no hay prendas aquí</Text>
          </View>
        }
        ListFooterComponent={<Button title="+ Añadir prenda" onPress={() => router.push('/add')} style={{ margin: 6, marginTop: 12 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  limit: { paddingHorizontal: 18, color: colors.muted, fontSize: 12 },
  list: { padding: 10, paddingBottom: 40 },
  empty: { alignItems: 'center', padding: 40 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: colors.muted, marginTop: 8 },
});
