import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FACE_STEPS } from './model';

const ICONS = { left: 'arrow-left', right: 'arrow-right', mouth: 'smile' } as const;
const PROMPTS = [
  { title: 'Turn your head left', body: 'Keep your face inside the frame and slowly turn left.' },
  { title: 'Turn your head right', body: 'Now slowly turn your head to the right.' },
  { title: 'Open your mouth', body: 'Face forward and open your mouth briefly.' },
];
const INK = '#F6F3EE';
const DIM = 'rgba(246,243,238,0.78)';
const BASE = '#1D1B19';

export function FaceStep({ index, remaining, onBack, onCaptured }: { index: number; remaining: number; onBack: () => void; onCaptured: (base64: string) => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [camError, setCamError] = useState('');
  const [requesting, setRequesting] = useState(false);
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState(remaining);
  const capturing = useRef(false);
  const captureCallback = useRef(onCaptured);
  captureCallback.current = onCaptured;
  const i = Math.min(2, Math.max(0, index));
  const prompt = PROMPTS[i];

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => setActive(s === 'active'));
    return () => sub.remove();
  }, []);

  const granted = !!permission?.granted;
  const showCamera = granted && active && !camError;
  useEffect(() => { setCountdown(remaining); capturing.current = false; }, [index, remaining]);
  useEffect(() => {
    if (!showCamera || !ready || capturing.current) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (countdown > 0) { setCountdown(value => value - 1); return; }
      capturing.current = true;
      try {
        const photo = await camera.current?.takePictureAsync({ base64: true, quality: 0.6 });
        if (!photo?.base64) throw new Error('Could not capture your face. Please return and try again.');
        if (!cancelled) await captureCallback.current(photo.base64);
      } catch (cause) {
        if (!cancelled) setCamError(cause instanceof Error ? cause.message : 'Face capture failed.');
      }
    }, 1000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [showCamera, ready, countdown, index]);

  const enable = async () => {
    setRequesting(true);
    try {
      const r = await requestPermission();
      if (!r.granted) setCamError(r.canAskAgain ? 'Camera access was not allowed.' : 'Camera access is off. You can enable it in Settings.');
      else setCamError('');
    } catch {
      setCamError('Could not request camera access on this device.');
    } finally { setRequesting(false); }
  };

  let status = '';
  if (camError) status = camError;
  else if (!permission) status = 'Checking camera…';
  else if (!granted) status = 'Camera is off. Turn it on to see yourself in the frame.';
  else if (!active) status = 'Camera paused while the app is in the background.';

  return (
    <View style={st.root} testID="kyc-face-step">
      {showCamera ? (
        <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="front" active={active} onCameraReady={() => setReady(true)}
          onMountError={e => setCamError(e?.message ? `Camera unavailable: ${e.message}` : 'Camera unavailable on this device.')} />
      ) : (
        <LinearGradient colors={['#3A3632', BASE]} style={[StyleSheet.absoluteFill, st.center]}>
          <Feather name="user" size={120} color="rgba(246,243,238,0.12)" />
        </LinearGradient>
      )}
      <LinearGradient pointerEvents="none" colors={['rgba(20,18,16,0.55)', 'transparent']} style={[st.top, { height: insets.top + 120 }]} />
      <LinearGradient pointerEvents="none" colors={['transparent', 'rgba(20,18,16,0.92)']} style={st.bottomFade} />

      <View style={[st.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Close face check" hitSlop={8}
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
        </View>
      </View>

      <View style={[st.bottom, { paddingBottom: insets.bottom + 28 }]}>
        <View style={st.steps} accessibilityLabel={`Prompt ${i + 1} of 3`}>
          {FACE_STEPS.map((f, n) => (
            <View key={f.id} style={[st.chip, n === i && st.chipOn, n < i && st.chipDone]}>
              <Feather name={n < i ? 'check' : ICONS[f.id]} size={15} color={n === i ? BASE : INK} />
            </View>
          ))}
        </View>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={st.title}>{prompt.title}</Text>
        <Text style={st.body}>{prompt.body}</Text>
        <Text style={st.count} accessibilityLiveRegion="polite">
          Step {i + 1} of 3 · {Math.max(0, countdown)}s
        </Text>
        {!!status && (
          <View style={st.status}>
            <Text style={st.statusText}>
              {status}{Platform.OS === 'web' && camError ? ' Some browsers block the front camera.' : ''}
            </Text>
            {permission && !granted && permission.canAskAgain !== false && !camError && (
              <Pressable onPress={enable} disabled={requesting} accessibilityRole="button" testID="kyc-face-enable"
                style={({ pressed }) => [st.enable, (pressed || requesting) && { opacity: 0.75 }]}>
                <Feather name="camera" size={16} color={BASE} />
                <Text style={st.enableText}>{requesting ? 'Requesting…' : 'Enable camera'}</Text>
              </Pressable>
            )}
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
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, zIndex: 2 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(246,243,238,0.18)', alignItems: 'center', justifyContent: 'center' },
  frameWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingBottom: 140 },
  frame: { width: '82%', aspectRatio: 0.82, maxWidth: 380, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(246,243,238,0.45)' },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: INK, margin: -2 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 28, alignItems: 'center' },
  steps: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  chip: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(246,243,238,0.4)' },
  chipOn: { backgroundColor: INK, borderColor: INK },
  chipDone: { backgroundColor: 'rgba(246,243,238,0.22)', borderColor: 'transparent' },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 24, letterSpacing: -0.4, color: INK, textAlign: 'center' },
  body: { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 22, color: DIM, textAlign: 'center', marginTop: 8 },
  count: { fontFamily: 'DMSans_500Medium', fontSize: 13, letterSpacing: 0.4, color: DIM, marginTop: 14 },
  status: { marginTop: 16, alignItems: 'center', gap: 12 },
  statusText: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 19, color: DIM, textAlign: 'center' },
  enable: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 22, borderRadius: 23, backgroundColor: INK },
  enableText: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: BASE },
});
