import React, { useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useToast } from '@/components/toast/ToastProvider';
import { Heading, Notice, PrimaryButton, s } from '@/components/kyc/parts';
import { validatePasswordChange, type PasswordErrors } from './validation';
import { userApi } from '@/services/api';

type Key = 'current' | 'next' | 'confirm';

function PasswordField({ label, value, onChange, error, inputId, toggleId, errorId, inputRef, onSubmit, last }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; inputId: string; toggleId: string; errorId: string;
  inputRef?: React.RefObject<React.ComponentRef<typeof TextInput> | null>; onSubmit: () => void; last?: boolean;
}) {
  const c = useColors();
  const [visible, setVisible] = useState(false);
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: c.walletInk }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 54, borderRadius: 16, borderWidth: 1.5, backgroundColor: c.walletField, borderColor: error ? c.walletError : 'transparent' }}>
        <TextInput ref={inputRef} testID={inputId} accessibilityLabel={label} value={value} onChangeText={onChange}
          secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} spellCheck={false}
          autoComplete="off" textContentType="none" importantForAutofill="no" keyboardType="default"
          returnKeyType={last ? 'done' : 'next'} onSubmitEditing={onSubmit} blurOnSubmit={!!last}
          placeholder={label} placeholderTextColor={c.walletMuted}
          style={{ flex: 1, minHeight: 54, paddingHorizontal: 16, color: c.walletInk, fontFamily: 'DMSans_400Regular', fontSize: 15 }} />
        <Pressable testID={toggleId} onPress={() => setVisible((v) => !v)} hitSlop={6} accessibilityRole="button"
          accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          style={({ pressed }) => [{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, pressed && { transform: [{ scale: 0.92 }] }]}>
          <Feather name={visible ? 'eye-off' : 'eye'} size={19} color={c.walletSubtle} />
        </Pressable>
      </View>
      {!!error && <Text testID={errorId} accessibilityRole="alert" style={[s.error, { color: c.walletError }]}>{error}</Text>}
    </View>
  );
}

export function ChangePasswordScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [vals, setVals] = useState<Record<Key, string>>({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<PasswordErrors>({});
  const nextRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const pending = useRef(false);

  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/settings'); };
  const set = (k: Key) => (v: string) => {
    setVals((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const submit = async () => {
    if (pending.current) return;
    const e = validatePasswordChange(vals.current, vals.next, vals.confirm);
    setErrors(e);
    if (e.current || e.next || e.confirm) return;
    pending.current = true;
    try {
      await userApi.changePassword(vals.current, vals.next);
      setVals({ current: '', next: '', confirm: '' });
      Keyboard.dismiss();
      showToast({ kind: 'success', title: 'Password changed', body: 'Your account password was updated.' });
      back();
    } catch (cause) {
      showToast({ kind: 'error', title: 'Password change failed', body: cause instanceof Error ? cause.message : 'Please retry.' });
    } finally { pending.current = false; }
  };

  const top = (Platform.OS === 'web' ? 67 : insets.top) + 8;
  const bottom = Math.max(20, insets.bottom, Platform.OS === 'web' ? 34 : 0);

  return (
    <View testID="password-screen" style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingTop: top, paddingHorizontal: 12 }}>
        <Pressable testID="password-back" onPress={back} accessibilityRole="button" accessibilityLabel="Back"
          style={({ pressed }) => [{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, pressed && { transform: [{ scale: 0.92 }] }]}>
          <Feather name="arrow-left" size={24} color={c.walletInk} />
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, flexGrow: 1, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          <Heading title="Change password" body="Enter your current password and choose a new password for your account." />
          <PasswordField label="Current password" value={vals.current} onChange={set('current')} error={errors.current}
            inputId="password-current" toggleId="password-toggle-current" errorId="password-error-current" onSubmit={() => nextRef.current?.focus()} />
          <PasswordField label="New password" value={vals.next} onChange={set('next')} error={errors.next} inputRef={nextRef}
            inputId="password-new" toggleId="password-toggle-new" errorId="password-error-next" onSubmit={() => confirmRef.current?.focus()} />
          <PasswordField label="Confirm password" value={vals.confirm} onChange={set('confirm')} error={errors.confirm} inputRef={confirmRef}
            inputId="password-confirm" toggleId="password-toggle-confirm" errorId="password-error-confirm" onSubmit={submit} last />
          <View style={{ marginTop: 6 }}>
            <Notice icon="lock" text="Use 8 to 128 characters, different from your current one. Do not enter a password you use elsewhere." />
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: 24, paddingBottom: bottom, paddingTop: 8, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          <PrimaryButton testID="password-submit" label="Change password" onPress={submit} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
