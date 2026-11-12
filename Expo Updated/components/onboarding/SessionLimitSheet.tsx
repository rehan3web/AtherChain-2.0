import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Sheet } from '@/components/wallet/Sheet';
import { useColors } from '@/hooks/useColors';
import { PrimaryButton } from '@/components/kyc/parts';
import type { SessionLimit } from './sessionLimit';

export function SessionLimitSheet({ limit, removing, onRemove, onClose }: {
  limit: SessionLimit | null; removing: string | null; onRemove: (id: string) => void; onClose: () => void;
}) {
  const c = useColors();
  return <Sheet open={!!limit} title="Manage active sessions" onClose={onClose} onExited={() => {}}>
    <ScrollView testID="login-session-limit" contentContainerStyle={{ padding: 24, gap: 18 }}>
      <Text style={{ color: c.walletSubtle, fontSize: 14, fontFamily: 'DMSans_400Regular' }}>
        Two sessions are already active. Remove one to continue signing in here.
      </Text>
      {limit?.sessions.map(session => <View key={session.id} style={{ gap: 8 }}>
        <Text style={{ color: c.walletInk, fontSize: 16, fontFamily: 'DMSans_600SemiBold' }}>{session.device}</Text>
        {!!session.loginTime && <Text style={{ color: c.walletSubtle, fontSize: 12 }}>
          {Number.isFinite(Date.parse(session.loginTime)) ? new Date(session.loginTime).toLocaleString() : ''}
        </Text>}
        <PrimaryButton testID={`login-remove-session-${session.id}`} label="Remove and continue"
          loading={removing === session.id} disabled={!!removing}
          onPress={() => onRemove(session.id)} />
      </View>)}
      <PrimaryButton testID="login-session-cancel" label="Cancel" variant="ghost" disabled={!!removing} onPress={onClose} />
    </ScrollView>
  </Sheet>;
}
