import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/components/toast/ToastProvider';
import { faceDataUri, type FacePhoto } from './model';

const INK = '#F6F3EE', DIM = 'rgba(246,243,238,0.78)', BASE = '#1D1B19';

export function FaceStep({ submitting, onBack, onCaptured }: {
  submitting: boolean; onBack: () => void; onCaptured: (photo: FacePhoto) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const { showToast, dismissToast } = useToast();
  const failureToast = useRef<number | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [failed, setFailed] = useState(false);
  const [working, setWorking] = useState(false);
  const camera = useRef<CameraView>(null);
  const mounted = useRef(true), ready = useRef(false), locked = useRef(false), armed = useRef(false);
  const attempt = useRef(0), activeRef = useRef(active);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => { if (timeout.current) clearTimeout(timeout.current); timeout.current = null; };
  const cancel = () => { attempt.current++; armed.current = false; locked.current = false; clearTimer(); if (mounted.current) setWorking(false); };
  const error = (message: string) => {
    if (!mounted.current) return;
    cancel(); setFailed(true); ready.current = false;
    failureToast.current = showToast({ kind: 'error', title: 'Live photo', body: message });
  };
  useEffect(() => {
    mounted.current = true;
    const sub = AppState.addEventListener('change', state => {
      activeRef.current = state === 'active'; setActive(activeRef.current);
      if (state === 'background') cancel();
    });
    return () => { mounted.current = false; cancel(); sub.remove(); };
  }, []);
  const showCamera = !!permission?.granted && active && !failed && !submitting;
  if (!showCamera) ready.current = false;

  const capture = async (ticket: number) => {
    if (!armed.current || !ready.current || !activeRef.current || ticket !== attempt.current) return;
    armed.current = false; clearTimer();
    try {
      if (!camera.current) throw new Error('Camera unavailable. Try again.');
      const photo = await camera.current.takePictureAsync({ base64: true, quality: 0.6 });
      if (!mounted.current || ticket !== attempt.current || !activeRef.current) return;
      const encoded = photo?.base64 ?? '';
      const data = /^data:(image\/[\w+.-]+);base64,(.*)$/.exec(encoded);
      const uriType = /^data:(image\/[\w+.-]+);base64,/.exec(photo?.uri ?? '')?.[1];
      const face = { base64: data?.[2] ?? encoded, mimeType: data?.[1] ?? uriType ?? (photo?.format === 'png' ? 'image/png' : 'image/jpeg') };
      faceDataUri(face);
      await onCaptured(face);
    } catch (cause) {
      if (mounted.current && ticket === attempt.current)
        error(cause instanceof Error ? cause.message : 'Could not take the live photo.');
    } finally {
      if (ticket === attempt.current) {
        locked.current = false;
        if (mounted.current) setWorking(false);
      }
    }
  };
  const start = async () => {
    if (locked.current || submitting || !activeRef.current) return;
    if (failureToast.current !== null) dismissToast(failureToast.current);
    failureToast.current = null;
    locked.current = true; setWorking(true);
    const ticket = ++attempt.current;
    try {
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!mounted.current || ticket !== attempt.current) return;
        if (!result.granted) throw new Error(result.canAskAgain
          ? 'Camera access was not allowed. Allow access and try again.'
          : 'Enable camera access in your device or browser settings, then try again.');
      }
      if (failed) { ready.current = false; setFailed(false); }
      armed.current = true;
      timeout.current = setTimeout(() => {
        if (mounted.current && ticket === attempt.current && armed.current)
          error('The camera did not become ready. Try again.');
      }, 12000);
      // Ready callback can finish a user-started action, never start one itself.
      void capture(ticket);
    } catch (cause) {
      if (mounted.current && ticket === attempt.current)
        error(cause instanceof Error ? cause.message : 'Could not request camera access.');
    }
  };
  const busy = working || submitting;
  return (
    <View style={st.root} testID="kyc-face-step">
      {showCamera ? <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="front" active={active}
        onCameraReady={() => { ready.current = true; void capture(attempt.current); }}
        onMountError={e => error(e?.message ? `Camera unavailable: ${e.message}` : 'Camera unavailable. Try again.')} />
        : <LinearGradient colors={['#3A3632', BASE]} style={[StyleSheet.absoluteFill, st.center]}>
          <Feather name="user" size={120} color="rgba(246,243,238,0.12)" />
        </LinearGradient>}
      <LinearGradient pointerEvents="none" colors={['rgba(20,18,16,0.55)', 'transparent']} style={[st.top, { height: insets.top + 120 }]} />
      <LinearGradient pointerEvents="none" colors={['transparent', 'rgba(20,18,16,0.92)']} style={st.bottomFade} />
      <View style={[st.header, { paddingTop: insets.top + 10 }]}>
        <Pressable testID="kyc-face-close" disabled={submitting} onPress={() => { cancel(); onBack(); }}
          accessibilityRole="button" accessibilityLabel="Close live photo" hitSlop={8} style={st.close}>
          <Feather name="x" size={22} color={INK} />
        </Pressable>
      </View>
      <View style={st.frameWrap}>
        <View pointerEvents="none" style={st.frame} />
        <Pressable testID="kyc-face-capture" onPress={start} disabled={busy || !active}
          accessibilityRole="button" accessibilityLabel="Take and submit live photo"
          accessibilityState={{ disabled: busy || !active, busy }} style={st.capture}>
          {busy ? <ActivityIndicator testID="kyc-face-loading" color={BASE} size="large" />
            : <Feather name="camera" size={36} color={BASE} />}
        </Pressable>
      </View>
      <View style={[st.bottom, { paddingBottom: insets.bottom + 28 }]}>
        <Text accessibilityRole="header" style={st.title}>One live photo</Text>
        <Text style={st.body}>{submitting ? 'Submitting your application for manual review…'
          : !active ? 'Camera paused while the app is inactive.'
            : 'Look straight at the front camera and tap the camera icon.'}</Text>
        <Text style={[st.body, { marginTop: 16 }]}>Taking the photo automatically submits your details and both document images for manual review. This is not verified biometric liveness.</Text>
      </View>
    </View>
  );
}
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BASE },
  center: { alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 20, zIndex: 2 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(246,243,238,0.18)', alignItems: 'center', justifyContent: 'center' },
  frameWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingBottom: 170 },
  frame: { position: 'absolute', width: '82%', aspectRatio: 0.82, maxWidth: 380, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(246,243,238,0.45)', borderRadius: 6 },
  capture: { width: 88, height: 88, borderRadius: 44, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 28, alignItems: 'center' },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 24, letterSpacing: -0.4, color: INK, textAlign: 'center' },
  body: { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 22, color: DIM, textAlign: 'center', marginTop: 8 },
});
