import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { fallbackPlacement, fitGarment, Placement } from '../lib/body/fit';
import { FrontFrame, frontFrame } from '../lib/body/frame';
import { BodyMeasurements } from '../lib/body/measurements';
import { buildBody, BodyModel } from '../lib/body/model';
import { resolveImage } from '../lib/images';
import { colors } from '../lib/theme';
import { Garment, OutfitSlots, Slot } from '../lib/types';
import { MannequinGL } from './MannequinGL';
import { MannequinSilhouette } from './MannequinSilhouette';

// Draw order: lower layers first.
const LAYERS: Slot[] = ['shoes', 'bottom', 'top', 'dress', 'outerwear', 'accessory'];

const LABELS: Record<Slot, string> = {
  top: 'Arriba',
  outerwear: 'Abrigo',
  bottom: 'Abajo',
  dress: 'Vestido',
  shoes: 'Calzado',
  accessory: 'Accesorio',
};

interface Props {
  width: number;
  slots: OutfitSlots;
  garmentById: (id?: string) => Garment | undefined;
  skinTone: string;
  body: BodyMeasurements;
  background?: string;
  facePhotoUri?: string;
  onPressSlot?: (slot: Slot) => void;
  onPressFace?: () => void;
  /** Thumbnails: 2D silhouette, no buttons. */
  compact?: boolean;
}

/** Renders one garment image, sliced into bands that follow the body's shape. */
function GarmentImage({ uri, p, frame }: { uri: string; p: Placement; frame: FrontFrame }) {
  const s = frame.scale;
  const bands = p.bands ?? [{ t0: 0, t1: 1, sx: 1 }];
  const flip = p.mirror ? [{ scaleX: -1 }] : undefined;
  return (
    <>
      {bands.map((b) => {
        const w = p.w * b.sx * s;
        const tl = frame.toScreen(p.cx - (p.w * b.sx) / 2, p.top - b.t0 * p.h);
        const bandH = (b.t1 - b.t0) * p.h * s;
        return (
          <View key={b.t0} style={{ pointerEvents: 'none', position: 'absolute', left: tl.x, top: tl.y, width: w, height: bandH + 0.75, overflow: 'hidden' }}>
            <Image
              source={{ uri }}
              style={{ position: 'absolute', left: 0, top: -b.t0 * p.h * s, width: w, height: p.h * s, transform: flip }}
              contentFit="fill"
              transition={150}
            />
          </View>
        );
      })}
    </>
  );
}

function hotspotPositions(model: BodyModel): Record<Slot, [number, number]> {
  const a = model.anchors;
  return {
    outerwear: [-(a.shoulderHalf + 9), a.shoulderY + 2],
    top: [0, a.chestY - 4],
    dress: [0, a.chestY - 4],
    bottom: [0, (a.crotchY + a.kneeY) / 2 + 4],
    shoes: [0, a.ankleY + 3],
    accessory: [a.hand[0] + 12, a.hand[1] + 6],
  };
}

export function Mannequin({ width, slots, garmentById, skinTone, body, background = colors.card, facePhotoUri, onPressSlot, onPressFace, compact }: Props) {
  const height = width * 2;
  const model = buildBody(body);
  const frame = frontFrame(model, width, height);
  const a = model.anchors;
  const hasDress = !!slots.dress;

  const face = (() => {
    const w = a.headHalfWidth * 1.7 * frame.scale;
    const h = a.headHalfHeight * 1.75 * frame.scale;
    const c = frame.toScreen(a.headCenter[0], a.headCenter[1] - a.headHalfHeight * 0.06);
    return { left: c.x - w / 2, top: c.y - h / 2, width: w, height: h, borderRadius: w };
  })();

  const processing = Object.values(slots).some((id) => garmentById(id)?.cutoutStatus === 'processing');
  const hot = hotspotPositions(model);
  const hotspots: Slot[] = compact ? [] : (['outerwear', hasDress ? 'dress' : 'top', hasDress ? null : 'bottom', 'shoes', 'accessory'].filter(Boolean) as Slot[]);
  const hotSize = Math.min(width * 0.18, 58);

  return (
    <View style={{ width, height }}>
      {compact ? (
        <MannequinSilhouette model={model} frame={frame} width={width} height={height} skinTone={skinTone} />
      ) : (
        <MannequinGL body={body} skinTone={skinTone} background={background} width={width} height={height} mode="front" />
      )}

      {facePhotoUri ? (
        <Pressable onPress={onPressFace} disabled={!onPressFace} style={[styles.face, face]}>
          <Image source={{ uri: resolveImage(facePhotoUri) }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Pressable>
      ) : onPressFace ? (
        <Pressable onPress={onPressFace} style={[styles.face, face]} />
      ) : null}

      {LAYERS.map((slot) => {
        const g = garmentById(slots[slot]);
        if (!g) return null;
        const cut = g.cutoutUrl && g.fit ? resolveImage(g.cutoutUrl) : undefined;
        const placements = cut ? fitGarment(g.category, g.fit!, model) : g.imageUrl ? [fallbackPlacement(slot, model)] : [];
        return placements.map((p, i) => {
          const tl = frame.toScreen(p.cx - p.w / 2, p.top);
          const box = { left: tl.x, top: tl.y, width: p.w * frame.scale, height: p.h * frame.scale };
          return (
            <View key={`${slot}-${i}`} style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]}>
              {cut ? (
                <>
                  <GarmentImage uri={cut} p={p} frame={frame} />
                  <Pressable onPress={() => onPressSlot?.(slot)} disabled={!onPressSlot} style={[styles.hitbox, box]} />
                </>
              ) : (
                <Pressable onPress={() => onPressSlot?.(slot)} disabled={!onPressSlot} style={[styles.framed, box, compact && { borderRadius: 4, borderWidth: 1 }]}>
                  <Image source={{ uri: resolveImage(g.imageUrl) }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
                </Pressable>
              )}
            </View>
          );
        });
      })}

      {hotspots
        .filter((slot) => !slots[slot])
        .map((slot) => {
          const c = frame.toScreen(...hot[slot]);
          return (
            <Pressable
              key={`hot-${slot}`}
              onPress={() => onPressSlot?.(slot)}
              style={[styles.hotspot, { left: c.x - hotSize / 2, top: c.y - hotSize / 2, width: hotSize, height: hotSize, borderRadius: hotSize / 2 }]}
            >
              <Text style={styles.plus}>+</Text>
              <Text style={styles.hotLabel}>{LABELS[slot]}</Text>
            </Pressable>
          );
        })}

      {processing && !compact && (
        <View style={styles.processing}>
          <ActivityIndicator size="small" color={colors.text} />
          <Text style={styles.processingText}>Recortando prenda…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  face: { position: 'absolute', overflow: 'hidden' },
  hitbox: { position: 'absolute' },
  framed: { position: 'absolute', borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#fff', backgroundColor: '#fff' },
  hotspot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  plus: { fontSize: 18, color: colors.text, lineHeight: 20 },
  hotLabel: { fontSize: 9, color: colors.muted, fontWeight: '600' },
  processing: { position: 'absolute', top: 6, alignSelf: 'center', flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  processingText: { fontSize: 12, color: colors.text, fontWeight: '600' },
});
