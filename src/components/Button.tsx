import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors } from '../lib/theme';

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'gold';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const bg = variant === 'primary' ? colors.accent : variant === 'gold' ? colors.gold : colors.card;
  const fg = variant === 'secondary' ? colors.text : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        variant === 'secondary' && styles.outline,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.text, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  outline: { borderWidth: 1, borderColor: colors.border },
  text: { fontSize: 16, fontWeight: '700' },
});
