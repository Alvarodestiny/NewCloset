import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { StoreProvider, useStore } from '../lib/store';
import { colors } from '../lib/theme';

function Root() {
  const { ready } = useStore();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerTintColor: colors.text, headerStyle: { backgroundColor: colors.bg }, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="add" options={{ presentation: 'modal', title: 'Añadir prenda' }} />
      <Stack.Screen name="pick/[slot]" options={{ presentation: 'modal', title: 'Elige una prenda' }} />
      <Stack.Screen name="garment/[id]" options={{ title: 'Prenda' }} />
      <Stack.Screen name="body" options={{ title: 'Configuración de maniquí' }} />
      <Stack.Screen name="paywall" options={{ presentation: 'modal', headerShown: false }} />
    </Stack>
  );
}

export default function Layout() {
  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <Root />
    </StoreProvider>
  );
}
