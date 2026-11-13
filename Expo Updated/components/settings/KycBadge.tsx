import React from 'react';
import { Text, View } from 'react-native';

export function KycBadge({ status }: { status: string }) {
  const verified = status === 'approved';
  return <View testID="settings-kyc-badge" style={{
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, flexShrink: 0,
    backgroundColor: verified ? '#DCFCE7' : '#E5E7EB',
  }}>
    <Text style={{
      color: verified ? '#166534' : '#4B5563',
      fontFamily: 'DMSans_500Medium', fontSize: 12,
    }}>{verified ? 'Verified' : 'Unverified'}</Text>
  </View>;
}
