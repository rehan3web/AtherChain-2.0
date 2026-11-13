import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/hooks/useTheme';
import { ScalePressable } from '@/components/wallet/primitives';
import { useDockClearance } from '@/components/navigation/GlassDock';
import { useMining } from './useMining';
import { AtherWatcher } from './AtherWatcher';
import { RefillMeter } from './RefillMeter';
import { useToast } from '@/components/toast/ToastProvider';

const F = { r: 'DMSans_400Regular', m: 'DMSans_500Medium', s: 'DMSans_600SemiBold', b: 'DMSans_700Bold' };
const fmt = (v: number, d = 4) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const hms = (ms: number) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
};

export default function MiningScreen() {
  const c = useColors();
  const isDark = useTheme().scheme === 'dark';
  const claimColors: [string, string] = isDark ? ['#ffffff', '#f4f4f5'] : [c.walletDarkTop, c.walletDarkBottom];
  const claimInk = isDark ? '#18181b' : c.walletOnInk;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const actionHeight = Math.min(62, Math.max(46, Math.min(width, 480) * .132));
  const actionFont = Math.min(21, Math.max(15, Math.min(width, 480) * .046));
  const { clearance } = useDockClearance();
  const { loading, busy, error, snapshot: s, claim, retry, boosts, maxBoosts: MAX_BOOSTS, boostEnabled, boost } = useMining();
  const { showToast } = useToast();
  useEffect(() => {
    if (error && !s) showToast({ kind: 'error', title: 'Could not load mining progress', body: error });
  }, [error, s, showToast]);
  const top = Platform.OS === 'web' ? 67 : insets.top;

  const baseDaily = s ? s.ratePerHour * 24 : 0;
  const previewDaily = s?.cycleReward ?? baseDaily;
  const boostLeft = MAX_BOOSTS - boosts;
  const ready = !!s && s.canClaim;
  const claimDisabled = loading || !s || busy || !s.canClaim;
  const boostDisabled = !s || boostLeft <= 0 || busy || !boostEnabled;
  const claimLabel = busy ? 'Claiming' : 'Claim';
  const handleBoost = async () => {
    if (boostDisabled) return;
    try {
      await boost();
      showToast({ kind: 'success', title: 'Boost applied', body: 'Your mining boost was confirmed by the server.' });
    } catch (cause) {
      showToast({ kind: 'error', title: 'Boost failed', body: cause instanceof Error ? cause.message : 'Please retry.' });
    }
  };
  const handleClaim = async () => {
    if (claimDisabled) return;
    const result = await claim();
    if (!result) return;
    showToast(result.ok
      ? { kind: 'success', title: 'Claim successful', body: `${fmt(result.amount)} AT added to your balance.` }
      : { kind: 'error', title: 'Claim could not be saved', body: result.message });
  };

  const rows = [
    { k: 'Total Balance', v: s ? `${fmt(s.totalBalance)} AT` : '—', id: 'total-balance' },
    { k: 'Daily Yield', v: s ? `${fmt(previewDaily)} AT` : '—', id: 'daily-yield' },
    { k: 'Boost Left', v: String(boostLeft), id: 'boost-left' },
    { k: 'Status', v: !s ? '—' : ready ? 'Ready' : 'Refilling', id: 'status' },
  ];

  return (
    <View style={[tw`flex-1`, { backgroundColor: c.miningPage }]}>
      <ScrollView
        contentContainerStyle={[tw`px-5 items-center`, { flexGrow: 1, justifyContent: 'center', paddingTop: top + 16, paddingBottom: clearance + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.companion}>
          <AtherWatcher />
          <View
            testID="mining-boost-meter-left"
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Left boost cells"
            accessibilityValue={{ min: 0, max: MAX_BOOSTS, now: boosts, text: `${boosts} of ${MAX_BOOSTS} cells filled` }}
            style={[styles.boostMeter, { left: 8 }]}
          >
            <View style={[styles.cellTrack, { borderColor: c.miningHairline, backgroundColor: c.walletSurfaceTop }]}>
              {Array.from({ length: MAX_BOOSTS }, (_, index) => (
                <View
                  key={index}
                  testID={`mining-boost-cell-left-${index + 1}`}
                  style={[styles.boostCell, { backgroundColor: boosts > index ? c.walletPositive : c.walletDisabled }]}
                />
              ))}
            </View>
          </View>
          <View style={[styles.boostMeter, { right: 8 }]}>
            <RefillMeter progress={s?.progress ?? null} />
          </View>
        </View>

        <View
          accessibilityLabel={`Next mining session ${s ? hms(s.remainingMs) : 'loading'}`}
          accessibilityLiveRegion="polite"
          style={[tw`flex-row items-center justify-between px-4 rounded-2xl`, { marginTop: -18, minHeight: 40, width: 240, backgroundColor: c.miningPill }]}
        >
          <Text style={[tw`text-xs`, { color: c.walletSubtle, fontFamily: F.r }]}>Next Mining Session</Text>
          <Text style={[tw`text-xs`, { color: c.walletInk, fontFamily: F.m, fontVariant: ['tabular-nums'] }]}>
            {s ? hms(s.remainingMs) : '--:--:--'}
          </Text>
        </View>

        <LinearGradient
          colors={[c.walletSurfaceTop, c.walletInset]}
          style={[tw`w-full mt-8 rounded-3xl px-5`, { maxWidth: 380 }]}
        >
          {loading && !s ? (
            [0, 1, 2, 3].map((i) => (
              <View key={i}>
                {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.walletDisabled }} />}
                <View style={[tw`flex-row items-center justify-between`, { minHeight: 68 }]}>
                  <View style={[tw`h-3 w-24 rounded`, { backgroundColor: c.walletField }]} />
                  <View style={[tw`h-3 w-16 rounded`, { backgroundColor: c.walletField }]} />
                </View>
              </View>
            ))
          ) : error && !s ? (
            <View style={tw`items-center py-6`}>
              <Feather name="alert-circle" size={20} color={c.walletError} />
              <Text style={[tw`text-sm mt-2 text-center`, { color: c.walletInk, fontFamily: F.m }]}>Couldn't read saved mining progress.</Text>
              <Text style={[tw`text-xs mt-1 text-center`, { color: c.walletSubtle, fontFamily: F.r }]}>{error}</Text>
              <ScalePressable testID="mining-retry" accessibilityRole="button" accessibilityLabel="Try again" onPress={retry} style={[tw`mt-3 px-5 h-10 rounded-full items-center justify-center`, { backgroundColor: c.walletInk }]}>
                <Text style={[tw`text-sm`, { color: c.walletOnInk, fontFamily: F.s }]}>Try again</Text>
              </ScalePressable>
            </View>
          ) : (
            rows.map((r, index) => (
              <View key={r.id}>
                {index > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.walletDisabled }} />}
                <View accessible accessibilityLabel={`${r.k}: ${r.v}`} style={[tw`flex-row items-center justify-between gap-3 py-4`, { minHeight: 68 }]}>
                  <Text style={[tw`text-xs flex-shrink`, { color: c.walletSubtle, fontFamily: F.r, lineHeight: 18 }]}>{r.k}</Text>
                  <View style={tw`flex-row items-center gap-2`}>
                    {r.id === 'status' && !!s && !ready && <Feather name="clock" size={15} color={c.walletSubtle} />}
                    <Text testID={`mining-${r.id}`} style={{ fontSize: 15, color: r.id === 'status' && ready ? c.walletPositive : c.walletInk, fontFamily: F.m, fontVariant: ['tabular-nums'] }}>{r.v}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </LinearGradient>

        {error && s ? (
          <Text accessibilityLiveRegion="polite" style={[tw`text-xs text-center mt-3`, { color: c.walletError, fontFamily: F.r }]}>{error}</Text>
        ) : null}

        <View style={[tw`w-full flex-row mt-6`, { maxWidth: 380, gap: 8 }]}>
          <ScalePressable
            testID="mining-boost"
            accessibilityRole="button"
            accessibilityLabel={`Boost mining, ${boostLeft} left`}
            accessibilityHint="Changes the displayed daily yield only. Claim rewards are unchanged."
            accessibilityState={{ disabled: boostDisabled }}
            disabled={boostDisabled}
            onPress={handleBoost}
            scaleTo={0.97}
            style={[styles.action, styles.lightShadow, { borderRadius: actionHeight / 2, shadowColor: c.walletInk, opacity: boostDisabled ? 0.5 : 1 }]}
          >
            <LinearGradient colors={[c.walletSurfaceTop, c.walletSurfaceBottom]} style={[styles.pill, { height: actionHeight, borderRadius: actionHeight / 2, borderWidth: StyleSheet.hairlineWidth, borderColor: c.miningHairline }]}>
              <Text numberOfLines={1} style={{ fontSize: actionFont, color: c.walletInk, fontFamily: F.m }}>Boost</Text>
              <Feather name="zap" size={actionFont * 1.1} color={c.walletInk} />
            </LinearGradient>
          </ScalePressable>
          <ScalePressable
            testID="mining-claim"
            accessibilityRole="button"
            accessibilityLabel={ready ? `Claim ${fmt(s!.pendingReward)} AT` : s ? `Claim, available in ${hms(s.remainingMs)}` : 'Claim'}
            accessibilityState={{ disabled: claimDisabled, busy }}
            disabled={claimDisabled}
            onPress={() => { void handleClaim(); }}
            scaleTo={0.97}
            style={[styles.action, styles.darkShadow, { borderRadius: actionHeight / 2, shadowColor: c.walletInk, opacity: claimDisabled && !busy ? 0.5 : 1 }]}
          >
            <LinearGradient testID="mining-claim-surface" colors={claimColors} style={[styles.pill, { height: actionHeight, borderRadius: actionHeight / 2 }]}>
              <View pointerEvents="none" style={[styles.sheen, { borderRadius: actionHeight }]} />
              {busy && <ActivityIndicator size="small" color={claimInk} />}
              <Text numberOfLines={1} style={{ fontSize: actionFont, color: claimInk, fontFamily: F.m }}>{claimLabel}</Text>
              {!busy && <Feather name="arrow-down" size={actionFont * 1.1} color={claimInk} />}
            </LinearGradient>
          </ScalePressable>
        </View>

        <Text style={[tw`text-[10px] text-center mt-5`, { color: c.walletMuted, fontFamily: F.r }]}>
          Mining eligibility and AT rewards are recorded by AtherChain. Availability follows server rules.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  companion: { width: '100%', maxWidth: 280, height: 258, alignItems: 'center', justifyContent: 'center' },
  boostMeter: { position: 'absolute', top: 82, alignItems: 'center' },
  cellTrack: { borderWidth: 1, borderRadius: 10, padding: 5, gap: 5, flexDirection: 'column-reverse' },
  boostCell: { width: 18, height: 24, borderRadius: 4 },
  action: { flex: 1, minWidth: 0 },
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden', paddingHorizontal: 8 },
  lightShadow: { shadowOpacity: .12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  darkShadow: { shadowOpacity: .4, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  sheen: { position: 'absolute', left: '12%', top: '4%', width: '46%', height: '46%', backgroundColor: 'rgba(255,255,255,0.14)' },
});

export { MiningScreen };
