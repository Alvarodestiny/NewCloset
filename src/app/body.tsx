import Slider from '@react-native-community/slider';
import { useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button } from '../components/Button';
import { MannequinGL, Turntable } from '../components/MannequinGL';
import { BODY_CONTROLS, BodyBase, DEFAULT_BODY, MeasurementKey } from '../lib/body/measurements';
import { useStore } from '../lib/store';
import { colors, SKIN_TONES } from '../lib/theme';

const STAGE_BG = '#EFEAE3';
const VIEWS = [
  { label: 'Frente', yaw: 0 },
  { label: 'Lado', yaw: Math.PI / 2 },
  { label: 'Espalda', yaw: Math.PI },
];

export default function BodySettings() {
  const store = useStore();
  const { body, skinTone } = store.profile;
  const { width, height } = useWindowDimensions();
  const [selected, setSelected] = useState<MeasurementKey>('shoulders');
  const [spinning, setSpinning] = useState(false);
  const [turntable] = useState(() => new Turntable());

  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
      onPanResponderGrant: () => {
        turntable.beginDrag();
        setSpinning(false);
      },
      onPanResponderMove: (_, g) => turntable.drag(g.dx),
    }),
  );

  const control = BODY_CONTROLS.find((c) => c.key === selected)!;
  const stageW = Math.min(width, 520);
  const stageH = Math.min(Math.round(height * 0.5), 460);

  const set = (key: MeasurementKey, value: number) => store.setBody({ ...body, [key]: Math.round(value) });
  const setBase = (base: BodyBase) => store.setBody({ ...body, base });
  const toggleSpin = () => {
    turntable.setAutoRotate(!spinning);
    setSpinning(!spinning);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} scrollEnabled>
      <View style={[styles.stage, { width: stageW, height: stageH }]} {...pan.panHandlers}>
        <MannequinGL body={body} skinTone={skinTone} background={STAGE_BG} width={stageW} height={stageH} mode="orbit" highlight={control.part} controls={turntable} />
        <View style={styles.stageBar}>
          {VIEWS.map((v) => (
            <Pressable
              key={v.label}
              onPress={() => {
                turntable.setYaw(v.yaw);
                setSpinning(false);
              }}
              style={styles.viewBtn}
            >
              <Text style={styles.viewText}>{v.label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={toggleSpin} style={[styles.viewBtn, spinning && styles.viewBtnActive]}>
            <Text style={[styles.viewText, spinning && { color: '#fff' }]}>360°</Text>
          </Pressable>
        </View>
        <Text style={styles.dragHint}>Arrastra para girar</Text>
      </View>

      <View style={styles.row}>
        {(['female', 'male'] as const).map((b) => (
          <Pressable key={b} onPress={() => setBase(b)} style={[styles.base, body.base === b && styles.baseActive]}>
            <Text style={[styles.baseText, body.base === b && { color: '#fff' }]}>{b === 'female' ? 'Base mujer' : 'Base hombre'}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.parts}>
        {BODY_CONTROLS.map((c) => (
          <Pressable key={c.key} onPress={() => setSelected(c.key)} style={[styles.part, selected === c.key && styles.partActive]}>
            <Text style={[styles.partText, selected === c.key && { color: '#fff' }]}>{c.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{control.label}</Text>
            <Text style={styles.cardHint}>{control.hint}</Text>
          </View>
          <Pressable onPress={() => set(selected, body[selected] - 1)} style={styles.step} hitSlop={6}>
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.value}>{body[selected]} cm</Text>
          <Pressable onPress={() => set(selected, body[selected] + 1)} style={styles.step} hitSlop={6}>
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
        <Slider
          minimumValue={control.min}
          maximumValue={control.max}
          step={1}
          value={body[selected]}
          onValueChange={(v: number) => set(selected, v)}
          minimumTrackTintColor={colors.gold}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.text}
          style={{ marginTop: 8 }}
        />
        <View style={styles.range}>
          <Text style={styles.rangeText}>{control.min} cm</Text>
          <Text style={styles.rangeText}>{control.max} cm</Text>
        </View>
      </View>

      <Text style={styles.section}>Tono de piel</Text>
      <View style={styles.tones}>
        {SKIN_TONES.map((t) => (
          <Pressable key={t} onPress={() => store.updateProfile({ skinTone: t })} style={[styles.tone, { backgroundColor: t }, skinTone === t && styles.toneActive]} />
        ))}
      </View>

      <Text style={styles.section}>Todas las medidas</Text>
      <View style={styles.card}>
        {BODY_CONTROLS.map((c) => (
          <Pressable key={c.key} onPress={() => setSelected(c.key)} style={styles.measureRow}>
            <Text style={[styles.measureLabel, selected === c.key && { fontWeight: '800' }]}>{c.label}</Text>
            <Text style={styles.measureValue}>{body[c.key]} cm</Text>
          </Pressable>
        ))}
      </View>
      <Button title="Restablecer medidas" variant="secondary" onPress={() => store.setBody(DEFAULT_BODY[body.base])} style={{ marginTop: 14 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, alignItems: 'stretch' },
  stage: { alignSelf: 'center', borderRadius: 24, overflow: 'hidden', backgroundColor: STAGE_BG },
  stageBar: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  viewBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.9)' },
  viewBtnActive: { backgroundColor: colors.accent },
  viewText: { fontSize: 12, fontWeight: '700', color: colors.text },
  dragHint: { position: 'absolute', top: 10, alignSelf: 'center', fontSize: 11, color: colors.muted },
  row: { flexDirection: 'row', gap: 10, marginTop: 16 },
  base: { flex: 1, paddingVertical: 11, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  baseActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  baseText: { fontWeight: '700', color: colors.text },
  parts: { gap: 8, paddingVertical: 14 },
  part: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  partActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  partText: { fontWeight: '700', color: colors.text, fontSize: 13 },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  cardHint: { color: colors.muted, fontSize: 12, marginTop: 2 },
  step: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 18, color: colors.text, lineHeight: 20 },
  value: { fontSize: 16, fontWeight: '800', color: colors.text, minWidth: 64, textAlign: 'center' },
  range: { flexDirection: 'row', justifyContent: 'space-between' },
  rangeText: { fontSize: 11, color: colors.muted },
  section: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 20, marginBottom: 8 },
  tones: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  tone: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: 'transparent' },
  toneActive: { borderColor: colors.text },
  measureRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  measureLabel: { color: colors.text },
  measureValue: { color: colors.muted, fontWeight: '600' },
});
