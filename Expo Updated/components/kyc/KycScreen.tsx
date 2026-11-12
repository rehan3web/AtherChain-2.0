import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Sheet } from '@/components/wallet/Sheet';
import {
  EMPTY_PERSONAL, EMPTY_RESIDENCE, validatePersonal, validateResidence,
  type DocumentType, type FieldErrors, type Personal, type Photo, type Residence, type KycReviewStatus,
} from './model';
import { chooseKycPhoto } from './media';
import { DocumentStep, IntroStep, PersonalStep, ResidenceStep, ResultStep } from './Steps';
import { PhotoSlot } from './PhotoSlot';
import { FaceStep } from './FaceStep';
import { CountrySheet, LanguageSheet } from './LanguageSheet';
import { Heading, PrimaryButton, Progress, s } from './parts';
import { kycApi } from '@/services/api';
import { appendImage } from '@/services/uploads';
import { refreshBackendData } from '@/services/refresh';
import { useBackendResource } from '@/hooks/useBackendResource';
import { useToast } from '@/components/toast/ToastProvider';
import { COUNTRIES } from './countries';

export function KycScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [doc, setDoc] = useState<DocumentType | null>(null);
  const [reviewStatus, setReviewStatus] = useState<KycReviewStatus>('pending');
  const { showToast } = useToast();
  const resource = useBackendResource(kycApi.status);
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current && step !== 7) return;
    const status = resource.data?.status;
    if (resource.data) hydrated.current = true;
    if (['pending', 'rejected', 'approved'].includes(status)) {
      setReviewStatus(status);
      setStep(7);
      const type = resource.data.id_type;
      if (type) setDoc(type === 'driving_license' ? 'driving' : type === 'national_id' ? 'id' : type);
    }
  }, [resource.data]);
  useEffect(() => { if (resource.error) showToast({ kind: 'error', title: 'Identity verification', body: resource.error }); }, [resource.error, showToast]);
  const [personal, setPersonal] = useState<Personal>(EMPTY_PERSONAL);
  const [residence, setResidence] = useState<Residence>(EMPTY_RESIDENCE);
  const [front, setFront] = useState<Photo | null>(null);
  const [back, setBack] = useState<Photo | null>(null);
  const [faceTick, setFaceTick] = useState(0);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [photoErr, setPhotoErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (step !== 7 || !foreground) return;
    const timer = setInterval(() => { void resource.reload(); }, 15000);
    return () => clearInterval(timer);
  }, [step, foreground, resource.reload]);
  const submitFace = async (base64: string) => {
    if (lock.current) return;
    if (faceTick < 4) { setFaceTick(value => value + 2); return; }
    lock.current = true; setBusy(true);
    try {
      if (!front || !back || !doc || !base64) throw new Error('Capture both document sides and a clear face image.');
      const form = new FormData();
      const fields = {
        full_name: personal.name.trim(), father_name: personal.fatherName.trim(),
        dob: personal.dob, language: personal.language, address: `${residence.address}, ${residence.state}`,
        city: residence.city, country: residence.country,
        country_code: COUNTRIES.find(country => country.name === residence.country)?.code ?? '',
        id_type: doc === 'driving' ? 'driving_license' : doc === 'id' ? 'national_id' : 'passport',
        id_number: personal.documentNumber ?? '', id_expiry: personal.idExpiry ?? '',
        face_scan_frame: `data:image/jpeg;base64,${base64}`,
        verification_logs: JSON.stringify({ capture: 'camera', promptsCompleted: 3, automaticLivenessVerified: false }),
      };
      Object.entries(fields).forEach(([key, value]) => form.append(key, value));
      await appendImage(form, 'id_front', front);
      await appendImage(form, 'id_back', back);
      await kycApi.submit(form);
      setReviewStatus('pending'); setStep(7);
      setPersonal(EMPTY_PERSONAL); setResidence(EMPTY_RESIDENCE); setFront(null); setBack(null);
      refreshBackendData();
    } catch (cause) {
      showToast({ kind: 'error', title: 'KYC submission failed', body: cause instanceof Error ? cause.message : 'Please retry.' });
      setFaceTick(0); setStep(5);
    } finally { lock.current = false; setBusy(false); }
  };
  const exit = useCallback(() => {
    mounted.current = false;
    if (router.canGoBack()) router.back(); else router.replace('/settings');
  }, []);
  const dirty = !!doc || JSON.stringify(personal) !== JSON.stringify(EMPTY_PERSONAL) ||
    JSON.stringify(residence) !== JSON.stringify(EMPTY_RESIDENCE) || !!front || !!back;

  const goBack = useCallback(() => {
    if (busy) return;
    setErrors({}); setPhotoErr('');
    if (step === 7) { exit(); return; }
    if (step === 0) { if (dirty) setConfirm(true); else exit(); return; }
    setStep(step - 1);
  }, [busy, step, dirty, exit]);
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { goBackRef.current(); return true; });
    return () => sub.remove();
  }, []);

  const pick = async (src: 'library' | 'camera', apply: (p: Photo) => void, frontCamera = false) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setPhotoErr('');
    try {
      const photo = await chooseKycPhoto(src, frontCamera);
      if (mounted.current && photo) apply(photo);
    } catch (e) {
      if (mounted.current) setPhotoErr(e instanceof Error ? e.message : 'Could not open the camera or photos.');
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const next = () => {
    if (busy) return;
    if ((step === 1 && !doc) || (step === 4 && !front) || (step === 5 && !back)) return;
    if (step === 2) { const e = validatePersonal(personal); setErrors(e); if (Object.keys(e).length) return; }
    if (step === 3) { const e = validateResidence(residence); setErrors(e); if (Object.keys(e).length) return; }
    setErrors({}); setPhotoErr('');
    if (step === 5) setFaceTick(0);
    setStep(step + 1);
  };
  const resubmit = () => {
    if (busy || reviewStatus !== 'rejected') return;
    setDoc(null); setPersonal(EMPTY_PERSONAL); setResidence(EMPTY_RESIDENCE);
    setFront(null); setBack(null); setFaceTick(0); setReviewStatus('pending');
    setErrors({}); setPhotoErr(''); setLangOpen(false); setCountryOpen(false); setConfirm(false);
    setStep(1);
  };
  const canNext = step === 1 ? !!doc : step === 4 ? !!front : step === 5 ? !!back : true;
  const docLabel = doc === 'passport' ? 'passport' : doc === 'driving' ? 'driving licence' : 'ID card';

  const body = () => {
    switch (step) {
      case 0: return <IntroStep />;
      case 1: return <DocumentStep value={doc} onChange={setDoc} />;
      case 2: return <PersonalStep value={personal} errors={errors} onChange={setPersonal} onLanguage={() => setLangOpen(true)} />;
      case 3: return <ResidenceStep value={residence} errors={errors} onChange={setResidence} onCountry={() => setCountryOpen(true)} />;
      case 4: case 5: {
        const side = step === 4 ? 'front' : 'back';
        return (
          <View>
            <Heading title={`${side === 'front' ? 'Front' : 'Back'} of your ${docLabel}`} body="Use your real, valid ID. Lay it flat with all four corners clearly visible." />
            <PhotoSlot side={side} photo={step === 4 ? front : back} busy={busy} error={photoErr}
              onPick={src => pick(src, step === 4 ? setFront : setBack)}
              onRemove={() => (step === 4 ? setFront(null) : setBack(null))} />
          </View>
        );
      }
      default: return <ResultStep document={doc} status={reviewStatus} />;
    }
  };

  const top = (Platform.OS === 'web' ? 67 : insets.top) + 8;
  const bottom = Math.max(20, insets.bottom, Platform.OS === 'web' ? 34 : 0);
  if (step === 6) {
    return <FaceStep index={Math.floor(faceTick / 2)} remaining={2 - faceTick % 2} onBack={goBack} onCaptured={submitFace} />;
  }
  return (
    <View testID="kyc-screen" style={{ flex: 1, backgroundColor: c.miningPage ?? c.background }}>
      <View style={{ paddingTop: top, paddingHorizontal: 12 }}>
        <Pressable testID="kyc-back" onPress={goBack} disabled={busy} accessibilityRole="button" accessibilityLabel="Back"
          style={({ pressed }) => [{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.4 : 1 }, pressed && { transform: [{ scale: 0.92 }] }]}>
          <Feather name="arrow-left" size={24} color={c.walletInk} />
        </Pressable>
      </View>
      <KeyboardAwareScrollViewCompat keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, flexGrow: 1, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        {step >= 1 && step <= 5 && <Progress step={step} total={6} />}
        {body()}
      </KeyboardAwareScrollViewCompat>
      {(
        <View style={{ paddingHorizontal: 24, paddingBottom: bottom, paddingTop: 8, gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          {step === 7 ? (
            <>
              {reviewStatus === 'rejected'
                ? <PrimaryButton testID="kyc-resubmit" label="Resubmit KYC" onPress={resubmit} />
                : <PrimaryButton testID="kyc-done" label="Done" onPress={exit} />}
            </>
          ) : (
            <PrimaryButton testID={step === 0 ? 'kyc-start' : 'kyc-next'} label={step === 0 ? 'Start' : 'Next'}
              onPress={next} disabled={busy || !canNext} />
          )}
        </View>
      )}
      <LanguageSheet open={langOpen} value={personal.language} onClose={() => setLangOpen(false)}
        onSelect={code => { setPersonal(p => ({ ...p, language: code })); setErrors(e => ({ ...e, language: '' })); setLangOpen(false); }} />
      <CountrySheet open={countryOpen} value={residence.country} onClose={() => setCountryOpen(false)}
        onSelect={country => { setResidence(r => ({ ...r, country })); setErrors(e => ({ ...e, country: '' })); setCountryOpen(false); }} />
      <Sheet open={confirm} title="Leave verification?" onClose={() => setConfirm(false)} onExited={() => {}}>
        <Text style={[s.body, { color: c.walletSubtle, marginBottom: 20 }]}>Your unsaved entries and photo selections will be cleared. Files already submitted may remain with your application. Original photos remain on your device.</Text>
        <View style={{ gap: 10 }}>
          <PrimaryButton testID="kyc-discard" label="Discard and leave" onPress={() => { setConfirm(false); exit(); }} />
          <PrimaryButton variant="ghost" label="Keep going" onPress={() => setConfirm(false)} />
        </View>
      </Sheet>
    </View>
  );
}
