import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useToast } from '@/components/toast/ToastProvider';
import { copyText } from '@/utils/clipboard';
import { referralApi } from '@/services/api';
import { useBackendResource } from '@/hooks/useBackendResource';
import { CACHE_POLICIES } from '@/services/cache';

function InviteArt() {
  const c = useColors();
  const blue = c.walletBlue;
  return (
    <Svg width={168} height={128} viewBox="0 0 168 128">
      <Circle cx={84} cy={66} r={56} fill={c.walletInset} />
      <Rect x={44} y={40} width={80} height={56} rx={10} fill={c.walletSurfaceTop} stroke={c.walletInk} strokeWidth={2} />
      <Path d="M46 44 L84 72 L122 44" fill="none" stroke={c.walletInk} strokeWidth={2} strokeLinejoin="round" />
      <Rect x={108} y={14} width={34} height={30} rx={6} fill={blue[3]} />
      <Rect x={122} y={14} width={6} height={30} fill={c.walletOnBlue} opacity={0.85} />
      <Path d="M125 14 C118 4 110 10 125 14 C140 10 132 4 125 14" fill="none" stroke={blue[3]} strokeWidth={2.5} />
      <Circle cx={30} cy={36} r={14} fill={c.walletPositiveSoft} stroke={c.walletPositive} strokeWidth={2} />
      <Path d="M24 36 L29 41 L37 31" fill="none" stroke={c.walletPositive} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={142} cy={92} r={4} fill={blue[2]} />
      <Circle cx={22} cy={90} r={3} fill={c.walletMuted} />
    </Svg>
  );
}

function Stat({ icon, value, label }: { icon: keyof typeof Feather.glyphMap; value: string; label: string }) {
  const c = useColors();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Feather name={icon} size={18} color={c.walletSubtle} />
      <Text style={[styles.statValue, { color: c.walletInk }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.walletSubtle }]}>{label}</Text>
    </View>
  );
}

export function ReferralScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { data, error } = useBackendResource(referralApi.stats, CACHE_POLICIES.referral);
  useEffect(() => { if (error) showToast({ kind: 'error', title: 'Referrals', body: error }); }, [error, showToast]);
  const REFERRAL_CODE = data?.referralCode ?? '';
  const INVITE_MESSAGE = data ? `Join me on AtherChain using my referral code ${REFERRAL_CODE}: ${data.referralLink}` : '';
  const verified = data?.referrals?.filter((item: { kyc_status: string }) => item.kyc_status === 'approved').length ?? 0;
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [copying, setCopying] = useState(false);
  const copyingRef = useRef(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const copyCode = async () => {
    if (copyingRef.current) return;
    copyingRef.current = true;
    setCopying(true);
    try {
      if (!REFERRAL_CODE) throw new Error('Your referral code has not loaded.');
      await copyText(REFERRAL_CODE);
      showToast({ kind: 'success', title: 'Referral code copied' });
    } catch {
      showToast({ kind: 'error', title: 'Could not copy referral code', body: 'Please try again.' });
    } finally {
      copyingRef.current = false;
      setCopying(false);
    }
  };

  const invite = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (!INVITE_MESSAGE) throw new Error('Your referral link has not loaded.');
      if (Platform.OS === 'web') {
        await copyText(INVITE_MESSAGE);
        showToast({ kind: 'success', title: 'Invitation copied', body: 'Paste it anywhere to invite a friend.' });
      } else {
        const result = await Share.share({ message: INVITE_MESSAGE });
        if (result.action === Share.sharedAction) showToast({ kind: 'success', title: 'Invitation shared' });
      }
    } catch {
      showToast({ kind: 'error', title: 'Could not share invitation', body: 'Please try again.' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <View testID="screen-referral" style={[styles.page, { backgroundColor: c.walletCardTop, paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={back} testID="referral-back" accessibilityRole="button" accessibilityLabel="Back to Home"
          style={({ pressed }) => [styles.back, { opacity: pressed ? 0.5 : 1 }]}>
          <Feather name="arrow-left" size={24} color={c.walletInk} />
        </Pressable>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><InviteArt /></View>
        <Text style={[styles.title, { color: c.walletInk }]}>Invite friends,{'\n'}grow the community</Text>

        <View style={[styles.card, { backgroundColor: c.walletSurfaceTop, borderColor: c.walletDisabled }]}>
          <View style={styles.row}>
            <Stat icon="user-plus" value={data ? `${data.config.unverifiedReward} AT` : '—'} label="Sign Up Reward" />
            <View style={[styles.vdiv, { backgroundColor: c.walletDisabled }]} />
            <Stat icon="shield" value={data ? `${data.config.verifiedReward} AT` : '—'} label="KYC Reward" />
          </View>
          <View style={[styles.hdiv, { backgroundColor: c.walletDisabled }]} />
          <View style={styles.row}>
            <Stat icon="user" value={data ? String(data.totalReferrals - verified) : '—'} label={'Unverified\nReferrals'} />
            <View style={[styles.vdiv, { backgroundColor: c.walletDisabled }]} />
            <Stat icon="user-check" value={data ? String(verified) : '—'} label={'Verified\nReferrals'} />
            <View style={[styles.vdiv, { backgroundColor: c.walletDisabled }]} />
            <Stat icon="users" value={data ? String(data.totalReferrals) : '—'} label={'Total\nReferrals'} />
          </View>
        </View>

        <View testID="referral-code-row" style={[styles.codeRow, { borderBottomColor: c.walletDisabled }]}>
          <Text style={[styles.codeLabel, { color: c.walletSubtle }]}>Referral Code</Text>
          <View style={styles.codeGroup}>
            <Text testID="referral-code" selectable style={[styles.code, { color: c.walletInk }]}>{REFERRAL_CODE}</Text>
            <Pressable testID="referral-copy-code" onPress={copyCode} disabled={copying}
              hitSlop={10}
              accessibilityRole="button" accessibilityLabel="Copy referral code"
              accessibilityState={{ disabled: copying, busy: copying }}
              style={({ pressed }) => [styles.copy, { opacity: copying || pressed ? 0.5 : 1 }]}>
              <Feather name="copy" size={18} color={c.walletInk} />
            </Pressable>
          </View>
        </View>
        <Text testID="referral-reward-conditions" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
          style={[styles.rewardNote, { color: c.walletSubtle }]}>
          Sign-up reward auto-credits after your friend’s first mining.
        </Text>
      </ScrollView>
      <View testID="referral-bottom-bar" style={[styles.bottomBar, { backgroundColor: c.walletCardTop, borderTopColor: c.walletDisabled, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable onPress={invite} disabled={busy} testID="referral-invite" accessibilityRole="button"
          accessibilityLabel={Platform.OS === 'web' ? 'Copy invitation message' : 'Invite friends'}
          accessibilityState={{ disabled: busy, busy }}
          style={({ pressed }) => [styles.cta, { backgroundColor: c.walletInk, opacity: busy ? 0.6 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          <Text style={[styles.ctaText, { color: c.walletOnInk }]}>{busy ? 'Opening…' : 'Invite Friends'}</Text>
          <Feather name="arrow-right" size={18} color={c.walletOnInk} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { height: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 24 },
  art: { alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 26, lineHeight: 32, fontFamily: 'DMSans_600SemiBold', letterSpacing: -0.8, textAlign: 'center' },
  rewardNote: { width: '100%', fontSize: 11, lineHeight: 17, fontFamily: 'DMSans_400Regular', textAlign: 'center', marginTop: 10 },
  card: { width: '100%', marginTop: 14, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, gap: 4 },
  statValue: { fontSize: 20, fontFamily: 'DMSans_600SemiBold', letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontFamily: 'DMSans_500Medium', textAlign: 'center' },
  vdiv: { width: StyleSheet.hairlineWidth, marginVertical: 14 },
  hdiv: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  codeRow: { width: '100%', marginTop: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, gap: 12 },
  codeLabel: { flexShrink: 1, fontSize: 15, lineHeight: 22, fontFamily: 'DMSans_400Regular' },
  codeGroup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  code: { fontSize: 15, lineHeight: 22, fontFamily: 'DMSans_500Medium' },
  copy: { width: 32, height: 24, alignItems: 'center', justifyContent: 'center' },
  bottomBar: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  cta: { width: '100%', maxWidth: 480, height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { fontSize: 16, fontFamily: 'DMSans_600SemiBold' },
});
