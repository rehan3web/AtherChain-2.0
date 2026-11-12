import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export type IconName = React.ComponentProps<typeof Feather>['name'];

export function Heading({ eyebrow, title, body }: { eyebrow?: string; title: string; body?: string }) {
  const c = useColors();
  return (
    <View style={s.heading}>
      {!!eyebrow && <Text style={[s.eyebrow, { color: c.walletSubtle }]}>{eyebrow}</Text>}
      <Text accessibilityRole="header" style={[s.title, { color: c.walletInk }]}>{title}</Text>
      {!!body && <Text style={[s.body, { color: c.walletSubtle }]}>{body}</Text>}
    </View>
  );
}

export function Progress({ step, total }: { step: number; total: number }) {
  const c = useColors();
  return (
    <View accessibilityLabel={`Step ${step} of ${total}`} style={s.progress}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[s.seg, { backgroundColor: i < step ? c.walletInk : c.walletDisabled }]} />
      ))}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, loading = false, testID, variant = 'solid' }: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean; testID?: string; variant?: 'solid' | 'ghost';
}) {
  const c = useColors();
  const solid = variant === 'solid';
  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled || loading} accessibilityRole="button"
      accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || loading, busy: loading }}
      style={({ pressed }) => [s.button, {
        backgroundColor: solid ? (disabled ? c.walletDisabled : c.walletInk) : c.walletField,
      }, pressed && { transform: [{ scale: 0.98 }] }]}>
      {loading ? <ActivityIndicator testID={testID ? `${testID}-loading` : undefined} color={solid ? (disabled ? c.walletDisabledInk : c.walletOnInk) : c.walletInk} />
        : <Text style={[s.buttonText, { color: solid ? (disabled ? c.walletDisabledInk : c.walletOnInk) : c.walletInk }]}>{label}</Text>}
    </Pressable>
  );
}

export function Notice({ text, icon = 'info' }: { text: string; icon?: IconName }) {
  const c = useColors();
  return (
    <View style={[s.notice, { backgroundColor: c.walletDemo }]}>
      <Feather name={icon} size={16} color={c.walletDemoInk} style={{ marginTop: 2 }} />
      <Text style={[s.noticeText, { color: c.walletDemoInk }]}>{text}</Text>
    </View>
  );
}

export function Field({ label, error, testID, ...rest }: TextInputProps & { label: string; error?: string; testID: string }) {
  const c = useColors();
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: c.walletInk }]}>{label}</Text>
      <TextInput testID={testID} accessibilityLabel={label} placeholderTextColor={c.walletMuted}
        style={[s.input, { backgroundColor: c.walletField, color: c.walletInk, borderColor: error ? c.walletError : 'transparent' }]}
        {...rest} />
    </View>
  );
}

export function Row({ icon, leading, title, sub, onPress, selected, testID, trailing }: {
  icon: IconName; leading?: React.ReactNode; title: string; sub?: string; onPress?: () => void; selected?: boolean; testID?: string; trailing?: IconName;
}) {
  const c = useColors();
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole={onPress ? 'radio' : undefined}
      accessibilityState={{ selected: !!selected, checked: !!selected }}
      style={({ pressed }) => [s.row, { borderBottomColor: c.walletDisabled }, pressed && { opacity: 0.7 }]}>
      {leading ?? <View style={[s.rowIcon, { backgroundColor: c.walletField }]}>
        <Feather name={icon} size={18} color={c.walletInk} />
      </View>}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.rowTitle, { color: c.walletInk }]}>{title}</Text>
        {!!sub && <Text style={[s.rowSub, { color: c.walletSubtle }]}>{sub}</Text>}
      </View>
      {trailing ? <Feather name={trailing} size={18} color={c.walletMuted} /> : selected != null && (
        <View style={[s.radio, { borderColor: selected ? c.walletInk : c.walletMuted, backgroundColor: selected ? c.walletInk : 'transparent' }]}>
          {selected && <Feather name="check" size={12} color={c.walletOnInk} />}
        </View>
      )}
    </Pressable>
  );
}

export const s = StyleSheet.create({
  heading: { gap: 10, marginBottom: 24 },
  eyebrow: { fontFamily: 'DMSans_500Medium', fontSize: 13, letterSpacing: 0.4 },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  body: { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 22 },
  progress: { flexDirection: 'row', gap: 6, marginBottom: 22 },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  button: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: 'DMSans_600SemiBold', fontSize: 16 },
  notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16 },
  noticeText: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 19 },
  field: { gap: 8, marginBottom: 18 },
  label: { fontFamily: 'DMSans_500Medium', fontSize: 14 },
  input: { minHeight: 54, borderRadius: 16, paddingHorizontal: 16, fontFamily: 'DMSans_400Regular', fontSize: 15, borderWidth: 1.5 },
  error: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth },
  rowIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: 'DMSans_600SemiBold', fontSize: 16 },
  rowSub: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 18 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
