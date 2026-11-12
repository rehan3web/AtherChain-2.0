import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Sheet } from '@/components/wallet/Sheet';
import { useDockClearance } from '@/components/navigation/GlassDock';
import { useProfile } from './profile';
import { ProfileForm } from './ProfileForm';
import { INFO, InfoDetail } from './InfoDetail';
import { AppearancePanel } from './AppearancePanel';
import { PrimaryButton } from '@/components/kyc/parts';
import { logoutDemo } from '@/components/onboarding/session';

type IconName = React.ComponentProps<typeof Feather>['name'];
type Panel = 'edit' | 'appearance' | keyof typeof INFO;
const TITLES: Record<Panel, string> = {
  edit: 'Personal Information', kyc: 'KYC Verification', sessions: 'Sessions',
  logout: 'Log out', appearance: 'Appearance',
};

function Row({ icon, label, onPress, testID, danger, last }: { icon: IconName; label: string; onPress: () => void; testID: string; danger?: boolean; last?: boolean }) {
  const c = useColors();
  const ink = danger ? c.walletError : c.walletInk;
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', minHeight: 68, borderRadius: 16, paddingHorizontal: 6 }, pressed && { backgroundColor: c.walletField, transform: [{ scale: 0.985 }] }]}>
      <Feather name={icon} size={22} color={ink} style={{ width: 40 }} />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', borderBottomWidth: last ? 0 : 1, borderBottomColor: c.walletField }}>
        <Text style={{ flex: 1, color: ink, fontFamily: 'DMSans_500Medium', fontSize: 17, paddingVertical: 18 }}>{label}</Text>
        {!danger && <Feather name="chevron-right" size={20} color={c.walletMuted} />}
      </View>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={{ marginTop: 40 }}>
      <Text accessibilityRole="header" style={{ color: c.walletInk, fontFamily: 'DMSans_600SemiBold', fontSize: 19, letterSpacing: -0.3, marginBottom: 6, paddingHorizontal: 6 }}>{title}</Text>
      {children}
    </View>
  );
}

export function SettingsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { clearance } = useDockClearance();
  const { profile, loading, error } = useProfile();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [shown, setShown] = useState<Panel | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const open = (p: Panel) => {
    if (p === 'edit' && loading) return;
    setLogoutError(''); setShown(p); setPanel(p);
  };
  const close = () => { if (!loggingOut) setPanel(null); };
  const logOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true); setLogoutError('');
    try {
      await logoutDemo();
      // The root entry gate removes the app screens and returns to onboarding.
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Could not log out. Please retry.');
    } finally { setLoggingOut(false); }
  };

  return (
    <View testID="screen-settings" style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ width: '100%', maxWidth: 640, alignSelf: 'center', paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 48, paddingHorizontal: 20, paddingBottom: clearance }} showsVerticalScrollIndicator={false}>
        <View testID="settings-profile" style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
          <View style={{ width: 64, height: 64, flexShrink: 0 }}>
            <LinearGradient
              testID="settings-gradient-avatar"
              colors={['#f69a27', '#db5380', '#b700d6']}
              locations={[0, .5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 64, height: 64, borderRadius: 32 }}
            />
            <Pressable testID="settings-edit-profile" onPress={() => open('edit')} disabled={loading} accessibilityRole="button" accessibilityLabel="Edit profile" hitSlop={10}
              style={({ pressed }) => [{ position: 'absolute', top: -4, right: -8, width: 28, height: 28, borderRadius: 14, backgroundColor: c.background, borderWidth: 1, borderColor: c.walletField, alignItems: 'center', justifyContent: 'center' }, pressed && { transform: [{ scale: 0.9 }], backgroundColor: c.walletFieldPressed }]}>
              <Feather name="edit-2" size={13} color={c.walletInk} />
            </Pressable>
          </View>
          <View testID="settings-profile-details" style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <>
              <View style={{ width: '70%', height: 22, borderRadius: 8, backgroundColor: c.walletField }} />
              <View style={{ width: '85%', height: 15, borderRadius: 6, backgroundColor: c.walletField, marginTop: 8 }} />
            </>
          ) : (
            <>
              <Text testID="settings-profile-name" numberOfLines={1} style={{ color: c.walletInk, fontFamily: 'DMSans_700Bold', fontSize: 24, letterSpacing: -0.5, textAlign: 'left' }}>{profile.name}</Text>
              <Text testID="settings-profile-username" numberOfLines={1} style={{ color: c.walletSubtle, fontFamily: 'DMSans_400Regular', fontSize: 16, marginTop: 6, textAlign: 'left' }}>@{profile.username}</Text>
            </>
          )}
          </View>
        </View>
        {error && <Text testID="settings-profile-error" style={{ color: c.walletError, fontFamily: 'DMSans_400Regular', fontSize: 13, marginTop: 10 }}>{error}</Text>}

        <Section title="Account">
          <Row testID="settings-row-personal" icon="user" label="Personal Information" onPress={() => open('edit')} />
          <Row testID="settings-row-kyc" icon="shield" label="KYC Verification" onPress={() => router.push('/kyc')} last />
        </Section>
        <Section title="Settings">
          <Row testID="settings-row-appearance" icon="sun" label="Appearance" onPress={() => open('appearance')} last />
        </Section>
        <Section title="Security">
          <Row testID="settings-row-sessions" icon="monitor" label="Sessions" onPress={() => router.push('/sessions')} />
          <Row testID="settings-row-2fa" icon="smartphone" label="2FA" onPress={() => router.push('/twofa')} />
          <Row testID="settings-row-passkey" icon="key" label="Passkey" onPress={() => router.push('/passkeys')} />
          <Row testID="settings-row-password" icon="lock" label="Change Password" onPress={() => router.push('/change-password')} last />
        </Section>
        <View style={{ marginTop: 32, borderTopWidth: 1, borderTopColor: c.walletField, paddingTop: 8 }}>
          <Row testID="settings-row-logout" icon="log-out" label="Log out" danger last onPress={() => open('logout')} />
        </View>
      </ScrollView>

      <Sheet open={panel !== null} title={shown ? TITLES[shown] : ''} onClose={close} onExited={() => setShown(null)}>
        {shown === 'edit' && <ProfileForm initial={profile} onDone={close} />}
        {shown === 'appearance' && <AppearancePanel />}
        {shown === 'logout' && <View style={{ gap: 16, paddingTop: 12 }}>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 22, color: c.walletSubtle }}>
            Sign out of your AtherChain account and return to the welcome screen? Your account data remains on the server.
          </Text>
          {!!logoutError && <Text testID="settings-logout-error" accessibilityRole="alert" style={{ fontFamily: 'DMSans_400Regular', color: c.walletError }}>{logoutError}</Text>}
          <PrimaryButton testID="settings-logout-confirm" label={loggingOut ? 'Logging out…' : 'Log out'} disabled={loggingOut} onPress={() => { void logOut(); }} />
          <PrimaryButton testID="settings-logout-cancel" label="Cancel" variant="ghost" disabled={loggingOut} onPress={close} />
        </View>}
        {shown && shown !== 'edit' && shown !== 'appearance' && shown !== 'logout' && <InfoDetail content={INFO[shown]} onClose={close} />}
      </Sheet>
    </View>
  );
}
