import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Sheet } from '@/components/wallet/Sheet';
import {
  EMPTY_PERSONAL, EMPTY_RESIDENCE, validatePersonal, validateResidence, kycReviewStatus, kycReviewDelay,
  type DocumentType, type FieldErrors, type Personal, type Photo, type Residence, type KycReviewStatus,
} from './model';
import { chooseKycPhoto } from './media';
import { DocumentStep, IntroStep, PersonalStep, ResidenceStep, ResultStep } from './Steps';
import { PhotoSlot } from './PhotoSlot';
import { FaceStep } from './FaceStep';
import { CountrySheet, LanguageSheet } from './LanguageSheet';
import { Heading, PrimaryButton, Progress, s } from './parts';

// Remember only the demo outcome during this app session, never form data/photos.
let submittedReview: { document: DocumentType | null; submittedAt: number } | null = null;

export function KycScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(submittedReview ? 7 : 0);
  const [doc, setDoc] = useState<DocumentType | null>(submittedReview?.document ?? null);
  const [reviewStatus, setReviewStatus] = useState<KycReviewStatus>(() =>
    submittedReview ? kycReviewStatus(submittedReview.submittedAt, Date.now()) : 'pending');
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
    if (step !== 6 || !foreground) return;
    const timer = setTimeout(() => {
      if (!mounted.current) return;
      if (faceTick >= 5) {
        submittedReview = { document: doc, submittedAt: Date.now() };
        setReviewStatus('pending');
        setPersonal(EMPTY_PERSONAL); setResidence(EMPTY_RESIDENCE);
        setFront(null); setBack(null);
        setStep(7);
      }
      else setFaceTick(tick => tick + 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [step, faceTick, foreground, doc]);
  useEffect(() => {
    if (step !== 7 || !foreground || !submittedReview) return;
    const submittedAt = submittedReview.submittedAt;
    const now = Date.now();
    setReviewStatus(kycReviewStatus(submittedAt, now));
    const delay = kycReviewDelay(submittedAt, now);
    if (delay === null) return;
    const timer = setTimeout(() => {
      if (mounted.current && submittedReview?.submittedAt === submittedAt)
        setReviewStatus(kycReviewStatus(submittedAt, Date.now()));
    }, delay);
    return () => clearTimeout(timer);
  }, [step, foreground, reviewStatus]);
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
    submittedReview = null;
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
            <Heading title={`${side === 'front' ? 'Front' : 'Back'} of your ${docLabel}`} body="Lay it flat with all four corners visible. A sample card or printout works fine for this demo." />
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
    return <FaceStep index={Math.floor(faceTick / 2)} remaining={2 - faceTick % 2} onBack={goBack} />;
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
      <Sheet open={confirm} title="Leave the demo?" onClose={() => setConfirm(false)} onExited={() => {}}>
        <Text style={[s.body, { color: c.walletSubtle, marginBottom: 20 }]}>Your entries and photo selections will be cleared from this session. Nothing was uploaded. Original photos and camera cache files remain on your device.</Text>
        <View style={{ gap: 10 }}>
          <PrimaryButton testID="kyc-discard" label="Discard and leave" onPress={() => { setConfirm(false); exit(); }} />
          <PrimaryButton variant="ghost" label="Keep going" onPress={() => setConfirm(false)} />
        </View>
      </Sheet>
    </View>
  );
}
