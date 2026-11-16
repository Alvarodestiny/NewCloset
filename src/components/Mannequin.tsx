import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import { resolveImage } from '../lib/images';
import { colors } from '../lib/theme';
import { Garment, OutfitSlots, Slot } from '../lib/types';

/** Garment areas as fractions of the mannequin box (x, y, width, height). */
const REGIONS: Record<Slot, { x: number; y: number; w: number; h: number; label: string }> = {
  top: { x: 0.22, y: 0.17, w: 0.56, h: 0.3, label: 'Arriba' },
  outerwear: { x: 0.12, y: 0.15, w: 0.76, h: 0.36, label: 'Abrigo' },
  bottom: { x: 0.27, y: 0.44, w: 0.46, h: 0.42, label: 'Abajo' },
  dress: { x: 0.2, y: 0.17, w: 0.6, h: 0.55, label: 'Vestido' },
  shoes: { x: 0.24, y: 0.86, w: 0.52, h: 0.13, label: 'Calzado' },
  accessory: { x: 0.8, y: 0.42, w: 0.2, h: 0.16, label: 'Accesorio' },
};

// Draw order: lower layers first.
const LAYERS: Slot[] = ['bottom', 'top', 'dress', 'shoes', 'outerwear', 'accessory'];

interface Props {
  width: number;
  slots: OutfitSlots;
  garmentById: (id?: string) => Garment | undefined;
  skinTone: string;
  facePhotoUri?: string;
  onPressSlot?: (slot: Slot) => void;
  onPressFace?: () => void;
  compact?: boolean;
}

export function Mannequin({ width, slots, garmentById, skinTone, facePhotoUri, onPressSlot, onPressFace, compact }: Props) {
  const height = width * 2;
  const headSize = width * 0.2;
  const hasDress = !!slots.dress;

  // Empty-slot hotspots shown only when interactive.
  const hotspots: Slot[] = compact
    ? []
    : (['outerwear', hasDress ? 'dress' : 'top', hasDress ? null : 'bottom', 'shoes', 'accessory'].filter(Boolean) as Slot[]);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox="0 0 300 600">
        {/* neck */}
        <Rect x={138} y={88} width={24} height={22} rx={8} fill={skinTone} />
        {/* torso */}
        <Path
          d="M95 112 Q150 98 205 112 L222 135 Q228 210 212 270 L200 290 Q150 300 100 290 L88 270 Q72 210 78 135 Z"
          fill={skinTone}
        />
        {/* arms */}
        <Path d="M82 125 Q60 135 55 190 L48 290 Q52 300 62 296 L74 200 L88 160 Z" fill={skinTone} />
        <Path d="M218 125 Q240 135 245 190 L252 290 Q248 300 238 296 L226 200 L212 160 Z" fill={skinTone} />
        {/* legs */}
        <Path d="M100 285 L148 290 L146 520 Q140 530 128 528 L104 520 Z" fill={skinTone} />
        <Path d="M200 285 L152 290 L154 520 Q160 530 172 528 L196 520 Z" fill={skinTone} />
        {/* feet */}
        <Ellipse cx={124} cy={540} rx={24} ry={11} fill={skinTone} />
        <Ellipse cx={176} cy={540} rx={24} ry={11} fill={skinTone} />
        {!facePhotoUri && <Ellipse cx={150} cy={55} rx={30} ry={38} fill={skinTone} />}
      </Svg>

      {/* head / face */}
      <Pressable
        onPress={onPressFace}
        disabled={!onPressFace}
        style={[
          styles.face,
          { width: headSize, height: headSize * 1.25, left: (width - headSize) / 2, top: height * 0.03, borderRadius: headSize },
        ]}
      >
        {facePhotoUri ? <Image source={{ uri: resolveImage(facePhotoUri) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      </Pressable>

      {/* garments */}
      {LAYERS.map((slot) => {
        const g = garmentById(slots[slot]);
        if (!g?.imageUrl) return null;
        const r = REGIONS[slot];
        return (
          <Pressable
            key={slot}
            onPress={() => onPressSlot?.(slot)}
            disabled={!onPressSlot}
            style={{ position: 'absolute', left: r.x * width, top: r.y * height, width: r.w * width, height: r.h * height, alignItems: 'center', justifyContent: 'center' }}
          >
            <Image
              source={{ uri: resolveImage(g.imageUrl) }}
              style={[styles.garment, { borderRadius: compact ? 6 : 14 }]}
              contentFit={slot === 'shoes' || slot === 'accessory' ? 'contain' : 'cover'}
              contentPosition="top"
              transition={200}
            />
          </Pressable>
        );
      })}

      {/* empty slot buttons */}
      {hotspots
        .filter((slot) => !slots[slot])
        .map((slot) => {
          const r = REGIONS[slot];
          const size = Math.min(width * 0.2, 64);
          const cx = (r.x + r.w / 2) * width;
          const cy = (r.y + r.h / (slot === 'outerwear' ? 6 : 2)) * height;
          const left = slot === 'outerwear' ? r.x * width - size * 0.15 : cx - size / 2;
          return (
            <Pressable
              key={`hot-${slot}`}
              onPress={() => onPressSlot?.(slot)}
              style={[styles.hotspot, { left, top: cy - size / 2, width: size, height: size, borderRadius: size / 2 }]}
            >
              <Text style={styles.plus}>+</Text>
              <Text style={styles.hotLabel}>{r.label}</Text>
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  garment: { width: '100%', height: '100%', borderWidth: 2, borderColor: '#fff', backgroundColor: '#fff' },
  face: { position: 'absolute', overflow: 'hidden', backgroundColor: 'transparent' },
  hotspot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  plus: { fontSize: 18, color: colors.text, lineHeight: 20 },
  hotLabel: { fontSize: 9, color: colors.muted, fontWeight: '600' },
});
