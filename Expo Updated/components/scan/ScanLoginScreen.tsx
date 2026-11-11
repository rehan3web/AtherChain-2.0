import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const INK = '#F6F3EE';
const DIM = 'rgba(246,243,238,0.78)';
const BASE = '#1D1B19';
const SCAN_MS = 2000;
const FRAME = 240;

export function ScanLoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [focused, setFocused] = useState(false);
  const [camError, setCamError] = useState('');
  const [done, setDone] = useState(false);
  const [reduced, setReduced] = useState(false);
  const mounted = useRef(true);
  const generation = useRef(0);
  const requested = useRef(false);
  const line = useRef(new Animated.Value(0)).current;

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

  // Dummy 2000ms timer: (re)starts whenever focused + foreground and not yet completed.
  const running = focused && appActive && !done;
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
    const t = setTimeout(() => {
      if (!mounted.current || gen !== generation.current) return;
      setDone(true);
      AccessibilityInfo.announceForAccessibility('Login Completed. Practice only. No real web session was created.');
    }, SCAN_MS);
    return () => { clearTimeout(t); loop?.stop(); if (gen === generation.current) generation.current += 1; };
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

  return (
    <View style={st.root} testID="scan-screen">
      {showCamera ? (
        <CameraView testID="scan-camera" style={StyleSheet.absoluteFill} facing="back" active={showCamera}
          onMountError={e => setCamError(e?.message ? `Camera unavailable: ${e.message}` : 'Camera unavailable on this device.')} />
      ) : (
        <LinearGradient colors={['#3A3632', BASE]} style={[StyleSheet.absoluteFill, st.center]}>
          <Feather name="monitor" size={110} color="rgba(246,243,238,0.10)" />
        </LinearGradient>
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
        <View style={st.frame}>
          <View style={[st.corner, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 6 }]} />
          <View style={[st.corner, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 6 }]} />
          <View style={[st.corner, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 6 }]} />
          <View style={[st.corner, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 6 }]} />
          {!done && !reduced && <Animated.View testID="scan-line" style={[st.line, { transform: [{ translateY }] }]} />}
          {done && (
            <View testID="scan-success-mark" style={[StyleSheet.absoluteFill, st.center]}>
              <View style={st.check}><Feather name="check" size={36} color={BASE} /></View>
            </View>
          )}
        </View>
      </View>

      <View style={[st.bottom, { paddingBottom: insets.bottom + 28 }]}>
        {done ? (
          <View testID="scan-success" style={st.block}>
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={st.title}>Login Completed</Text>
            <Text style={st.body}>Practice only. No real web session was created.</Text>
            <Pressable testID="scan-done" onPress={leave} accessibilityRole="button" accessibilityLabel="Done, return to dashboard"
              style={({ pressed }) => [st.primary, pressed && { transform: [{ scale: 0.98 }] }]}>
              <Text style={st.primaryText}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <View testID="scan-scanning" style={st.block}>
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={st.title}>Scanning…</Text>
            <Text style={st.body}>Hold the web login code inside the frame.</Text>
            {!!status && <Text style={st.statusText}>{status}</Text>}
          </View>
        )}
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
  check: { width: 72, height: 72, borderRadius: 36, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 28 },
  block: { alignItems: 'stretch', gap: 8 },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 24, letterSpacing: -0.4, color: INK, textAlign: 'center' },
  body: { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 22, color: DIM, textAlign: 'center' },
  statusText: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 19, color: DIM, textAlign: 'center', marginTop: 8 },
  primary: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: INK, marginTop: 16 },
  primaryText: { fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: BASE },
});
