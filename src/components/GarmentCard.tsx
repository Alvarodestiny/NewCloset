import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { resolveImage } from '../lib/images';
import { colors } from '../lib/theme';
import { CATEGORIES, Garment } from '../lib/types';

export function GarmentCard({ garment, onPress, onLongPress, selected }: {
  garment: Garment;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
}) {
  const cat = CATEGORIES.find((c) => c.key === garment.category);
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={[styles.card, selected && styles.selected]}>
      <View style={styles.imageWrap}>
        {garment.cutoutUrl || garment.imageUrl ? (
          <Image source={{ uri: resolveImage(garment.cutoutUrl ?? garment.imageUrl) }} style={[styles.image, garment.cutoutUrl && styles.cutout]} contentFit="contain" transition={150} />
        ) : (
          <Text style={styles.emoji}>{cat?.emoji}</Text>
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>{garment.name}</Text>
      {(garment.brand || garment.price) && (
        <Text style={styles.meta} numberOfLines={1}>
          {[garment.brand, garment.price].filter(Boolean).join(' · ')}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, margin: 6, backgroundColor: colors.card, borderRadius: 16, padding: 10, borderWidth: 1, borderColor: colors.border },
  selected: { borderColor: colors.accent, borderWidth: 2 },
  imageWrap: { aspectRatio: 0.8, borderRadius: 12, backgroundColor: '#F2EEE8', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  cutout: { width: '86%', height: '86%' },
  emoji: { fontSize: 40 },
  name: { marginTop: 8, fontSize: 13, fontWeight: '600', color: colors.text },
  meta: { marginTop: 2, fontSize: 11, color: colors.muted },
});
