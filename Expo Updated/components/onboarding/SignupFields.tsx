import React, { useState } from 'react';
import type { ColorValue } from 'react-native';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { s } from '@/components/kyc/parts';
import { CountryFlag } from '@/components/kyc/CountryFlag';
import { getPhoneCountry } from './phoneCountries';

/** Visible idle/focus/error border on any theme, local to onboarding (KYC Field untouched). */
export function useBorder(error?: string, focused?: boolean): ColorValue {
  const c = useColors();
  return error ? c.walletError : focused ? c.walletInk : c.walletMuted;
}

const NO_STORE = { autoCapitalize: 'none', autoCorrect: false, spellCheck: false, autoComplete: 'off', textContentType: 'none', importantForAutofill: 'no' } as const;

export const AuthField = React.forwardRef<React.ComponentRef<typeof TextInput>, TextInputProps & { label: string; error?: string; testID: string }>(function AuthField({ label, error, testID, onFocus, onBlur, style, ...rest }, ref) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  const borderColor = useBorder(error, focused);
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: c.walletInk }]}>{label}</Text>
      <TextInput ref={ref} testID={testID} accessibilityLabel={label} placeholderTextColor={c.walletMuted}
        onFocus={e => { setFocused(true); onFocus?.(e); }} onBlur={e => { setFocused(false); onBlur?.(e); }}
        style={[s.input, { backgroundColor: c.walletField, color: c.walletInk, borderColor }, style]} {...rest} />
    </View>
  );
});

export const PasswordField = React.forwardRef<React.ComponentRef<typeof TextInput>, TextInputProps & { label: string; error?: string; testID: string }>(function PasswordField({ label, error, testID, onFocus, onBlur, ...rest }, ref) {
  const c = useColors();
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const borderColor = useBorder(error, focused);
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: c.walletInk }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 54, borderRadius: 16, borderWidth: 1.5, backgroundColor: c.walletField, borderColor }}>
        <TextInput ref={ref} testID={testID} accessibilityLabel={label} secureTextEntry={!visible} {...NO_STORE}
          placeholder={label} placeholderTextColor={c.walletMuted}
          style={{ flex: 1, minHeight: 54, paddingHorizontal: 16, color: c.walletInk, fontFamily: 'DMSans_400Regular', fontSize: 15 }} {...rest}
          onFocus={e => { setFocused(true); onFocus?.(e); }} onBlur={e => { setFocused(false); onBlur?.(e); }} />
        <Pressable testID={`${testID}-toggle`} onPress={() => setVisible(v => !v)} hitSlop={6} accessibilityRole="button"
          accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          style={({ pressed }) => [{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, pressed && { transform: [{ scale: 0.92 }] }]}>
          <Feather name={visible ? 'eye-off' : 'eye'} size={19} color={c.walletSubtle} />
        </Pressable>
      </View>
    </View>
  );
});

export const noStoreProps = NO_STORE;

/** Pressable field that opens a sheet (country picker). */
export function SelectField({ label, value, placeholder, flag, error, onPress, testID }: {
  label: string; value: string; placeholder: string; flag?: string; error?: string; onPress: () => void; testID: string;
}) {
  const c = useColors();
  const borderColor = useBorder(error);
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: c.walletInk }]}>{label}</Text>
      <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value || 'not selected'}`}
        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 14,
          backgroundColor: c.walletField, borderColor }, pressed && { borderColor: c.walletInk, opacity: 0.85 }]}>
        {flag !== undefined && <CountryFlag code={flag} size={24} />}
        <Text style={{ flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 15, color: value ? c.walletInk : c.walletMuted }}>{value || placeholder}</Text>
        <Feather name="chevron-down" size={18} color={c.walletSubtle} />
      </Pressable>
    </View>
  );
}

export function PhoneField({ code, value, onChange, onPickCode, error, onSubmit, disabled = false }: {
  code: string; value: string; onChange: (v: string) => void; onPickCode: () => void; error?: string; onSubmit: () => void; disabled?: boolean;
}) {
  const c = useColors();
  const country = getPhoneCountry(code);
  const [focused, setFocused] = useState(false);
  const codeBorder = useBorder(error && !value ? error : undefined);
  const phoneBorder = useBorder(error, focused);
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: c.walletInk }]}>Phone number</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable testID="signup-calling-code" onPress={onPickCode} disabled={disabled} accessibilityRole="button"
          accessibilityLabel={`Calling code ${country ? `${country.name} +${country.dialCode.replace(/^\+/, '')}` : 'not selected'}`}
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 54, borderRadius: 16, borderWidth: 1.5, borderColor: codeBorder, paddingHorizontal: 12, backgroundColor: c.walletField }, pressed && { borderColor: c.walletInk, opacity: 0.85 }]}>
          <CountryFlag code={code} size={22} />
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: c.walletInk, fontVariant: ['tabular-nums'] }}>
            {country ? `+${country.dialCode.replace(/^\+/, '')}` : '+'}
          </Text>
          <Feather name="chevron-down" size={16} color={c.walletSubtle} />
        </Pressable>
        <TextInput testID="signup-phone" accessibilityLabel="Phone number" value={value} onChangeText={onChange} editable={!disabled} {...NO_STORE}
          keyboardType="phone-pad" placeholder="Phone number" placeholderTextColor={c.walletMuted} returnKeyType="done" onSubmitEditing={onSubmit}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={[s.input, { flex: 1, backgroundColor: c.walletField, color: c.walletInk, borderColor: phoneBorder }]} />
      </View>
    </View>
  );
}
