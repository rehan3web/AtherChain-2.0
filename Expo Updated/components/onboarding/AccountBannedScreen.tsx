import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { IdentityIllustration } from '@/components/kyc/Illustration';
import { PrimaryButton, s as kyc } from '@/components/kyc/parts';
import { WRAP, useInsets } from './Shell';

export function AccountBannedScreen() {
  const c = useColors();
  const { top, bottom } = useInsets();
  return (
    <View testID="account-banned-screen" style={{ flex: 1, paddingTop: top, backgroundColor: c.miningPage ?? c.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[WRAP, s.content]}>
        <IdentityIllustration icon="x" />
        <Text accessibilityRole="header" style={[kyc.title, { color: c.walletInk, textAlign: 'center', marginTop: 12 }]}>Account Banned</Text>
        <Text style={[kyc.body, { color: c.walletSubtle, textAlign: 'center', marginTop: 10, marginBottom: 24 }]}>
          This account cannot access AtherChain. Contact Help if you believe this is a mistake.
        </Text>
        <View style={{ width: '100%', marginBottom: 24 }}>
          <View style={[s.row, { borderBottomColor: c.walletDisabled, borderBottomWidth: 0.5 }]}>
            <Text style={[kyc.body, { color: c.walletSubtle }]}>Account Status</Text>
            <View style={s.status}>
              <Feather name="x-circle" size={18} color={c.walletError} />
              <Text testID="account-banned-status" style={[kyc.body, s.value, { color: c.walletError }]}>Banned</Text>
            </View>
          </View>
          <View style={s.row}>
            <Text style={[kyc.body, { color: c.walletSubtle }]}>Reason</Text>
            <Text testID="account-banned-reason" style={[kyc.body, s.value, { color: c.walletInk, flexShrink: 1, textAlign: 'right' }]}>Abuse of App</Text>
          </View>
        </View>
      </ScrollView>
      <View style={[WRAP, { paddingBottom: bottom, paddingTop: 12, flexDirection: 'row', gap: 10 }]}>
        <View style={{ flex: 1 }}>
          <PrimaryButton testID="account-banned-login" variant="ghost" label="Login" onPress={() => router.replace('/login')} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton testID="account-banned-help" label="Help" onPress={() => router.push('/help')} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingVertical: 16 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { fontFamily: 'DMSans_500Medium' },
});
