import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { saveProfile, validateProfile, type Profile, type ProfileErrors } from './profile';

export function ProfileForm({ initial, onDone }: { initial: Profile; onDone: () => void }) {
  const c = useColors();
  const [name, setName] = useState(initial.name);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);

  const submit = async () => {
    if (pending.current) return;
    const e = validateProfile({ name, username: initial.username });
    setErrors(e);
    setSaveError(null);
    if (e.name) return;
    if (e.username) { setSaveError(e.username); return; }
    pending.current = true;
    setSaving(true);
    try {
      await saveProfile({ name, username: initial.username });
      onDone();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, err: string | undefined, id: string, prefix?: string) => (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color: c.walletSubtle, fontFamily: 'DMSans_500Medium', fontSize: 13, marginBottom: 8 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.walletField, borderRadius: 14, paddingHorizontal: 14, height: 52, borderWidth: 1, borderColor: err ? c.walletError : 'transparent' }}>
        {prefix && <Text style={{ color: c.walletMuted, fontFamily: 'DMSans_500Medium', fontSize: 16, marginRight: 2 }}>{prefix}</Text>}
        <TextInput
          testID={id}
          accessibilityLabel={label}
          editable={!saving}
          value={value}
          onChangeText={(v) => { set(v); if (err) setErrors((p) => ({ ...p, [id.endsWith('name-input') && !prefix ? 'name' : 'username']: undefined })); }}
          autoCapitalize={prefix ? 'none' : 'words'}
          autoCorrect={false}
          placeholderTextColor={c.walletMuted}
          placeholder={label}
          style={{ flex: 1, color: c.walletInk, fontFamily: 'DMSans_500Medium', fontSize: 16 }}
        />
      </View>
      {err && <Text testID={`${id}-error`} style={{ color: c.walletError, fontFamily: 'DMSans_400Regular', fontSize: 13, marginTop: 6 }}>{err}</Text>}
    </View>
  );

  return (
    <View testID="profile-form" style={{ paddingTop: 8 }}>
      {field('Name', name, setName, errors.name, 'profile-name-input')}
      {saveError && <Text testID="profile-form-error" style={{ color: c.walletError, fontFamily: 'DMSans_500Medium', fontSize: 14, marginBottom: 14 }}>{saveError}</Text>}
      <Pressable
        testID="profile-form-save"
        onPress={submit}
        disabled={saving}
        accessibilityRole="button"
        style={({ pressed }) => [{ height: 52, borderRadius: 26, backgroundColor: c.walletInk, alignItems: 'center', justifyContent: 'center', opacity: saving ? 0.7 : 1 }, pressed && { transform: [{ scale: 0.98 }] }]}
      >
        {saving ? <ActivityIndicator color={c.walletOnInk} /> : <Text style={{ color: c.walletOnInk, fontFamily: 'DMSans_600SemiBold', fontSize: 16 }}>Save</Text>}
      </Pressable>
    </View>
  );
}
