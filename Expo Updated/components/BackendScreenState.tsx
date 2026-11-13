import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

/** Same centered, full-page loading treatment as the app's entry screen. */
export function BackendScreenState({ testID, error, onRetry, onBack }: {
  testID: string; error?: string | null; onRetry?: () => void; onBack?: () => void;
}) {
  const c = useColors();
  return (
    <View testID={testID} accessibilityLabel={error ? 'Could not load' : 'Loading'}
      accessibilityState={{ busy: !error }}
      style={{ flex: 1, minHeight: 240, alignSelf: 'stretch', backgroundColor: c.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      {error ? <>
        <Text accessibilityRole="alert" style={{ fontFamily: 'DMSans_400Regular', color: c.walletError, textAlign: 'center' }}>{error}</Text>
        {onRetry && <Pressable testID={`${testID}-retry`} accessibilityRole="button" onPress={onRetry}
          style={{ paddingHorizontal: 24, paddingVertical: 16, borderRadius: 28, backgroundColor: c.walletInk }}>
          <Text style={{ color: c.walletOnInk, fontFamily: 'DMSans_600SemiBold' }}>Retry</Text>
        </Pressable>}
      </> : <ActivityIndicator color={c.walletInk} />}
      {onBack && <Pressable testID={`${testID}-back`} accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={{ padding: 16 }}>
        <Text style={{ color: c.walletInk, fontFamily: 'DMSans_500Medium' }}>Back</Text>
      </Pressable>}
    </View>
  );
}
