import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Animated, AppState, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authApi } from '@/services/api';
import { useToast } from '@/components/toast/ToastProvider';
import { CodeCircles } from '@/components/twofa/CodeCircles';

const INK = '#F6F3EE';
const DIM = 'rgba(246,243,238,0.78)';
const BASE = '#1D1B19';
const FRAME = 240;

export function ScanLoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [focused, setFocused] = useState(false);
  const [camError, setCamError] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reduced, setReduced] = useState(false);
  const mounted = useRef(true);
  const generation = useRef(0);
  const requested = useRef(false);
  const line = useRef(new Animated.Value(0)).current;
  const approving = useRef(false);
  const { showToast } = useToast();
  const approve = async (raw: string) => {
    if (approving.current || done || !focused || !appActive) return;
    let token = raw;
    try {
      const data = JSON.parse(raw);
      token = data.qrToken;
    } catch { /* The web client also encodes the raw opaque token. */ }
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) return;
    approving.current = true;
    const confirm = await new Promise<boolean>(resolve => {
      if (Platform.OS === 'web') resolve(globalThis.confirm('Approve sign-in on the browser displaying this code? Only approve a sign-in you started.'));
      else Alert.alert('Approve browser sign-in?', 'Only approve this code if you started the sign-in on that browser.', [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Approve', onPress: () => resolve(true) },
      ], { cancelable: true, onDismiss: () => resolve(false) });
    });
    try {
      if (!confirm) return;
      setSaving(true);
      const result = await authApi.approveQRLogin(token);
      if (result.success !== true) throw new Error('The backend did not approve this login.');
      if (mounted.current) setDone(true);
      AccessibilityInfo.announceForAccessibility('Browser login approved.');
    } catch (cause) {
      showToast({ kind: 'error', title: 'Login approval failed', body: cause instanceof Error ? cause.message : 'Please retry.' });
    } finally { approving.current = false; if (mounted.current) setSaving(false); }
  };

  useEffect(() => {
    mounted.current = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (mounted.current) setReduced(v); }).catch(() => {});
    const rm = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const sub = AppState.addEventListener('change', s => setAppActive(s === 'active'));
    return () => { mounted.current = false; generation.current += 1; sub.remove(); rm.remove(); };
  }, []);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => { setFocused(false); generation.current += 1; };
  }, []));

  // Auto-request once, only when the status is resolved and still requestable.
  useEffect(() => {
    if (!permission || permission.granted || requested.current || done) return;
    if (permission.canAskAgain === false) {
      setCamError('Camera access is off. You can enable it in Settings.');
      return;
    }
    requested.current = true;
    requestPermission()
      .then(r => {
        if (!mounted.current) return;
        if (!r.granted) setCamError(r.canAskAgain ? 'Camera access was not allowed.' : 'Camera access is off. You can enable it in Settings.');
      })
      .catch(() => { if (mounted.current) setCamError('Could not request camera access on this device.'); });
  }, [permission, requestPermission, done]);

  // Animate the existing scan line; only a verified QR approval completes login.
  const running = focused && appActive && !done && !saving;
  useEffect(() => {
    if (!running) return;
    const gen = ++generation.current;
    let loop: Animated.CompositeAnimation | null = null;
    line.setValue(0);
    if (!reduced) {
      loop = Animated.loop(Animated.sequence([
        Animated.timing(line, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(line, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]));
      loop.start();
    }
    return () => { loop?.stop(); if (gen === generation.current) generation.current += 1; };
  }, [running, reduced, line]);

  const leave = () => {
    generation.current += 1;
    if (router.canGoBack()) router.back(); else router.replace('/');
  };

  const granted = !!permission?.granted;
  const showCamera = granted && appActive && focused && !camError && !done;
  const translateY = line.interpolate({ inputRange: [0, 1], outputRange: [0, FRAME - 4] });

  let status = '';
  if (!done) {
    if (camError) status = camError;
    else if (!permission) status = 'Checking camera…';
    else if (!granted) status = 'Waiting for camera access.';
  }

  // Replace the entire scanner tree, not an overlay above the camera or frame.
  if (done) return (
    <View style={st.root} testID="scan-screen">
      <View style={[st.header, { paddingTop: insets.top + 10 }]}>
        <Pressable testID="scan-back" onPress={leave} accessibilityRole="button" accessibilityLabel="Close scanner" hitSlop={8}
          style={({ pressed }) => [st.close, pressed && { opacity: 0.7 }]}>
          <Feather name="x" size={22} color={INK} />
        </Pressable>
      </View>
      <View testID="scan-success-mark" pointerEvents="none" style={st.frameWrap}>
        <CodeCircles key="scan-approved-animation" filled={6} phase="success" onFinished={() => {}} />
      </View>
      <View testID="scan-success" style={[st.bottom, st.block, { paddingBottom: insets.bottom + 28 }]}>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={st.title}>Scan Completed</Text>
        <Text style={st.body}>The browser sign-in was approved by AtherChain.</Text>
        <Pressable testID="scan-done" onPress={leave} accessibilityRole="button" accessibilityLabel="Done, return to dashboard"
          style={({ pressed }) => [st.primary, pressed && { transform: [{ scale: 0.98 }] }]}>
          <Text style={st.primaryText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={st.root} testID="scan-screen">
      {showCamera ? (
        <CameraView testID="scan-camera" style={StyleSheet.absoluteFill} facing="back" active={showCamera}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => { void approve(data); }}
          onMountError={e => setCamError(e?.message ? `Camera unavailable: ${e.message}` : 'Camera unavailable on this device.')} />
      ) : (
        <LinearGradient colors={['#3A3632', BASE]} style={[StyleSheet.absoluteFill, st.center]} />
      )}
      <LinearGradient pointerEvents="none" colors={['rgba(20,18,16,0.55)', 'transparent']} style={[st.top, { height: insets.top + 120 }]} />
      <LinearGradient pointerEvents="none" colors={['transparent', 'rgba(20,18,16,0.92)']} style={st.bottomFade} />

      <View style={[st.header, { paddingTop: insets.top + 10 }]}>
        <Pressable testID="scan-back" onPress={leave} accessibilityRole="button" accessibilityLabel="Close scanner" hitSlop={8}
          style={({ pressed }) => [st.close, pressed && { opacity: 0.7 }]}>
          <Feather name="x" size={22} color={INK} />
        </Pressable>
      </View>

      <View pointerEvents="none" style={st.frameWrap}>
        <View testID="scan-frame" style={st.frame}>
          <View style={[st.corner, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 }]} />
          <View style={[st.corner, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 }]} />
          <View style={[st.corner, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 }]} />
          <View style={[st.corner, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 }]} />
          {!saving && !reduced && <Animated.View testID="scan-line" style={[st.line, { transform: [{ translateY }] }]} />}
          {saving && (
            <View testID="scan-approving" style={[StyleSheet.absoluteFill, st.center]}>
              <ActivityIndicator size="large" color={INK} accessibilityLabel="Approving browser sign-in" />
            </View>
          )}
        </View>
      </View>

      <View style={[st.bottom, { paddingBottom: insets.bottom + 28 }]}>
        <View testID="scan-scanning" style={st.block}>
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={st.title}>Scanning…</Text>
            <Text style={st.body}>Hold the web login code inside the frame.</Text>
            {!!status && <Text style={st.statusText}>{status}</Text>}
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BASE },
  center: { alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, zIndex: 2 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(246,243,238,0.18)', alignItems: 'center', justifyContent: 'center' },
  frameWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingBottom: 160 },
  frame: { width: FRAME, height: FRAME, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(246,243,238,0.45)' },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: INK, margin: -2 },
  line: { position: 'absolute', left: 8, right: 8, top: 0, height: 2, borderRadius: 1, backgroundColor: INK, opacity: 0.85 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 28 },
  block: { alignItems: 'stretch', gap: 8 },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 24, letterSpacing: -0.4, color: INK, textAlign: 'center' },
  body: { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 22, color: DIM, textAlign: 'center' },
  statusText: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 19, color: DIM, textAlign: 'center', marginTop: 8 },
  primary: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: INK, marginTop: 16 },
  primaryText: { fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: BASE },
});
