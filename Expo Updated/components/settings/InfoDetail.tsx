import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

type IconName = React.ComponentProps<typeof Feather>['name'];

export type InfoContent = { icon: IconName; heading: string; body: string[]; action?: string };

export const INFO: Record<string, InfoContent> = {
  kyc: { icon: 'shield', heading: 'Verification is not available', body: ['AtherChain is a demo wallet. There is no identity provider connected, so no documents can be submitted or verified.', 'Your profile stays unverified, and nothing you do here changes that.'] },
  sessions: { icon: 'monitor', heading: 'No remote sessions', body: ['This app runs entirely on this device. There is no signed-in account, so there are no other devices or sessions to list or revoke.'] },
};

export function InfoDetail({ content, onClose }: { content: InfoContent; onClose: () => void }) {
  const c = useColors();
  return (
    <View testID="settings-info" style={{ paddingTop: 12 }}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.walletField, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        <Feather name={content.icon} size={22} color={c.walletInk} />
      </View>
      <Text style={{ color: c.walletInk, fontFamily: 'DMSans_600SemiBold', fontSize: 22, letterSpacing: -0.4, marginBottom: 10 }}>{content.heading}</Text>
      {content.body.map((p) => (
        <Text key={p} style={{ color: c.walletSubtle, fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 22, marginBottom: 10 }}>{p}</Text>
      ))}
      <Pressable
        testID="settings-info-close"
        onPress={onClose}
        accessibilityRole="button"
        style={({ pressed }) => [{ marginTop: 18, height: 52, borderRadius: 26, backgroundColor: c.walletField, alignItems: 'center', justifyContent: 'center' }, pressed && { transform: [{ scale: 0.98 }], backgroundColor: c.walletFieldPressed }]}
      >
        <Text style={{ color: c.walletInk, fontFamily: 'DMSans_600SemiBold', fontSize: 16 }}>{content.action ?? 'Close'}</Text>
      </Pressable>
    </View>
  );
}
