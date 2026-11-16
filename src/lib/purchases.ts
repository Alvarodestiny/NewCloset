/**
 * In-app purchase layer.
 *
 * For the App Store, connect this to RevenueCat (`react-native-purchases`)
 * or `expo-iap`: both need a development build (not Expo Go).
 * Until then the app runs in "demo" mode, where the purchase
 * button unlocks Premium locally so the full flow can be tested.
 */
export const PLANS = [
  { id: 'newcloset_premium_monthly', label: 'Mensual', price: '3,99 €', period: '/mes' },
  { id: 'newcloset_premium_yearly', label: 'Anual', price: '24,99 €', period: '/año', badge: 'Ahorra 48%' },
] as const;

export type PlanId = (typeof PLANS)[number]['id'];

export const DEMO_PURCHASES = true;

export async function purchase(_plan: PlanId): Promise<boolean> {
  if (DEMO_PURCHASES) {
    await new Promise((r) => setTimeout(r, 600));
    return true;
  }
  // TODO: Purchases.purchasePackage(...) and check the "premium" entitlement.
  return false;
}

export async function restorePurchases(): Promise<boolean> {
  if (DEMO_PURCHASES) return false;
  // TODO: Purchases.restorePurchases() and check the "premium" entitlement.
  return false;
}
