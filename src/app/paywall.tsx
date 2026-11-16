import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { PlanId, PLANS, purchase, restorePurchases } from '../lib/purchases';
import { useStore } from '../lib/store';
import { colors } from '../lib/theme';

const FEATURES = [
  ['✨', 'Añade prendas con una foto', 'La IA identifica la prenda y la busca en tiendas online.'],
  ['♾️', 'Armario ilimitado', 'Guarda todas las prendas que quieras.'],
  ['🪞', 'Looks ilimitados', 'Crea y guarda todos los conjuntos que imagines.'],
];

export default function Paywall() {
  const store = useStore();
  const [plan, setPlan] = useState<PlanId>('newcloset_premium_yearly');
  const [loading, setLoading] = useState(false);

  const buy = async () => {
    setLoading(true);
    const ok = await purchase(plan);
    setLoading(false);
    if (ok) {
      store.updateProfile({ isPremium: true });
      router.back();
    }
  };

  const restore = async () => {
    if (await restorePurchases()) {
      store.updateProfile({ isPremium: true });
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()} style={styles.close} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <Text style={styles.kicker}>NEWCLOSET PREMIUM</Text>
        <Text style={styles.title}>Tu armario, sin límites</Text>

        {FEATURES.map(([emoji, title, text]) => (
          <View key={title} style={styles.feature}>
            <Text style={styles.featureEmoji}>{emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>{title}</Text>
              <Text style={styles.featureText}>{text}</Text>
            </View>
          </View>
        ))}

        <View style={{ gap: 10, marginTop: 18 }}>
          {PLANS.map((p) => (
            <Pressable key={p.id} onPress={() => setPlan(p.id)} style={[styles.plan, plan === p.id && styles.planActive]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planLabel}>{p.label}</Text>
                {'badge' in p && <Text style={styles.planBadge}>{p.badge}</Text>}
              </View>
              <Text style={styles.planPrice}>{p.price}<Text style={styles.planPeriod}>{p.period}</Text></Text>
            </Pressable>
          ))}
        </View>

        <Button title="Continuar" variant="gold" onPress={buy} loading={loading} style={{ marginTop: 20 }} />
        <Pressable onPress={restore}><Text style={styles.restore}>Restaurar compras</Text></Pressable>
        <Text style={styles.legal}>La suscripción se renueva automáticamente salvo que la canceles al menos 24 h antes del final del periodo. Puedes gestionarla en los ajustes de tu cuenta de Apple.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.accent },
  container: { padding: 22, paddingBottom: 40 },
  close: { alignSelf: 'flex-end' },
  closeText: { color: '#fff', fontSize: 22 },
  kicker: { color: colors.gold, fontWeight: '800', letterSpacing: 2, marginTop: 10 },
  title: { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 6, marginBottom: 18 },
  feature: { flexDirection: 'row', gap: 14, marginBottom: 16, alignItems: 'flex-start' },
  featureEmoji: { fontSize: 24 },
  featureTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  featureText: { color: '#BDB6AC', marginTop: 2 },
  plan: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1.5, borderColor: '#4A4540', padding: 16 },
  planActive: { borderColor: colors.gold, backgroundColor: '#2A2622' },
  planLabel: { color: '#fff', fontWeight: '700', fontSize: 16 },
  planBadge: { color: colors.gold, fontSize: 12, fontWeight: '700', marginTop: 2 },
  planPrice: { color: '#fff', fontWeight: '800', fontSize: 18 },
  planPeriod: { color: '#BDB6AC', fontSize: 13, fontWeight: '500' },
  restore: { color: '#BDB6AC', textAlign: 'center', marginTop: 16, textDecorationLine: 'underline' },
  legal: { color: '#7D766D', fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 16 },
});
