import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard } from 'react-native';
import { router } from 'expo-router';
import { Heading, Notice, PrimaryButton, Progress } from '@/components/kyc/parts';
import { CountrySheet } from '@/components/kyc/LanguageSheet';
import { COUNTRIES } from '@/components/kyc/countries';
import { EMPTY_SIGNUP, SIGNUP_STEPS, getSignupEmail, maskSignupEmail, validateSignupStep, type SignupDraft, type SignupStep } from './model';
import { Shell, StepTransition } from './Shell';
import { AuthField, PasswordField, PhoneField, SelectField, noStoreProps } from './SignupFields';
import { CallingCodeSheet } from './CallingCodeSheet';
import { SignupOtp } from './SignupOtp';

const COPY: Record<Exclude<SignupStep, 'otp'>, [string, string]> = {
  identifier: ['Create your practice account', 'Start with any made-up email or username. Nothing is sent or saved.'],
  username: ['Choose a username', '3 to 30 letters, numbers, dots or underscores.'],
  password: ['Set a password', 'Use 8 to 128 characters. Never a password you use elsewhere.'],
  name: ['What should we call you?', 'Any name works. It disappears when you leave.'],
  country: ['Where are you based?', 'Pick a country from the list.'],
  referral: ['Got a referral code?', 'Optional. Enter one or skip ahead.'],
  phone: ['Add a phone number', 'Choose a calling code, then the local number. No SMS is sent.'],
};

export function SignupScreen() {
  const [draft, setDraft] = useState<SignupDraft>(EMPTY_SIGNUP);
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState<'country' | 'calling' | null>(null);
  const otpCancel = useRef<() => boolean>(() => true);
  const step = SIGNUP_STEPS[idx];
  const refs = useRef<Record<string, { focus: () => void } | null>>({});

  const clear = useCallback(() => { setDraft(EMPTY_SIGNUP); setErrors({}); }, []);
  useEffect(() => () => { otpCancel.current(); }, []);

  const goBack = useCallback(() => {
    Keyboard.dismiss(); setErrors({}); setSheet(null);
    if (step === 'otp' && !otpCancel.current()) return;
    if (idx === 0) {
      clear();
      if (router.canGoBack()) router.back(); else router.replace('/onboarding');
      return;
    }
    setDir(-1); setIdx(i => i - 1);
  }, [idx, step, clear]);
  const backRef = useRef(goBack);
  backRef.current = goBack;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { backRef.current(); return true; });
    return () => sub.remove();
  }, []);

  const set = (k: keyof SignupDraft) => (v: string) => {
    setDraft(p => ({ ...p, [k]: v }));
    const ek = k === 'phoneCountry' ? 'phoneCountry' : k;
    if (errors[ek]) setErrors(p => { const n = { ...p }; delete n[ek]; return n; });
  };

  const next = (skip = false) => {
    const d = skip ? { ...draft, referral: '' } : draft;
    if (skip) setDraft(d);
    const e = validateSignupStep(step, d);
    setErrors(e);
    if (Object.keys(e).length) return;
    Keyboard.dismiss();
    setDir(1); setIdx(i => Math.min(i + 1, SIGNUP_STEPS.length - 1));
  };

  const flagFor = COUNTRIES.find(x => x.name === draft.country)?.code ?? '';
  const focus = (k: string) => () => refs.current[k]?.focus();
  const reg = (k: string) => (r: { focus: () => void } | null) => { refs.current[k] = r; };

  const body = () => {
    switch (step) {
      case 'identifier': return <>
        <AuthField testID="signup-identifier" label="Email or username" value={draft.identifier} onChangeText={set('identifier')}
          error={errors.identifier} placeholder="you@example.com" keyboardType="email-address" {...noStoreProps} returnKeyType="next" onSubmitEditing={() => next()} />
        {!!draft.identifier.trim() && !draft.identifier.includes('@') && (
          <AuthField testID="signup-email" label="Email for verification" value={draft.email} onChangeText={set('email')}
            error={errors.email} placeholder="you@example.com" keyboardType="email-address" {...noStoreProps} returnKeyType="next" onSubmitEditing={() => next()} />
        )}
      </>;
      case 'username': return <AuthField testID="signup-username" label="Username" value={draft.username} onChangeText={set('username')}
        error={errors.username} placeholder="satoshi_n" {...noStoreProps} returnKeyType="next" onSubmitEditing={() => next()} />;
      case 'password': return <>
        <PasswordField testID="signup-password" label="Password" value={draft.password} onChangeText={set('password')} error={errors.password}
          returnKeyType="next" blurOnSubmit={false} onSubmitEditing={focus('confirm')} />
        <PasswordField ref={reg('confirm')} testID="signup-confirm" label="Confirm password" value={draft.confirmPassword} onChangeText={set('confirmPassword')}
          error={errors.confirmPassword} returnKeyType="done" onSubmitEditing={() => next()} />
      </>;
      case 'name': return <>
        <AuthField testID="signup-first-name" label="First name" value={draft.firstName} onChangeText={set('firstName')} error={errors.firstName}
          maxLength={60} autoCorrect={false} autoComplete="off" returnKeyType="next" onSubmitEditing={() => next()} />
        <AuthField testID="signup-last-name" label="Last name" value={draft.lastName} onChangeText={set('lastName')} error={errors.lastName}
          maxLength={60} autoCorrect={false} autoComplete="off" returnKeyType="done" onSubmitEditing={() => next()} />
      </>;
      case 'country': return <SelectField testID="signup-country" label="Country" value={draft.country} placeholder="Select a country"
        flag={flagFor} error={errors.country} onPress={() => { Keyboard.dismiss(); setSheet('country'); }} />;
      case 'referral': return <AuthField testID="signup-referral" label="Referral code (optional)" value={draft.referral} onChangeText={set('referral')}
        error={errors.referral} maxLength={32} placeholder="e.g. ATHER-7Q2" {...noStoreProps} returnKeyType="done" onSubmitEditing={() => next()} />;
      case 'phone': return <PhoneField code={draft.phoneCountry} value={draft.phone} onChange={set('phone')} error={errors.phone ?? errors.phoneCountry}
        onPickCode={() => { Keyboard.dismiss(); setSheet('calling'); }} onSubmit={() => next()} />;
      default: return null;
    }
  };

  if (step === 'otp') {
    return <SignupOtp key="otp" maskedEmail={maskSignupEmail(getSignupEmail(draft))} cancelRef={otpCancel} onDone={clear} onBack={goBack} />;
  }
  return (
    <Shell testID="signup-screen" backID="signup-back" backLabel={idx === 0 ? 'Back to welcome' : 'Previous step'} onBack={goBack}
      footer={<>
        <PrimaryButton testID="signup-next" label="Next" onPress={() => next()} />
        {step === 'referral' && <PrimaryButton testID="signup-skip" variant="ghost" label="Skip" onPress={() => next(true)} />}
      </>}>
      <Progress step={idx + 1} total={SIGNUP_STEPS.length} />
      <StepTransition testID={`signup-step-${step}`} stepKey={step} dir={dir}>
          <React.Fragment key={step}>
            <Heading eyebrow={`Step ${idx + 1} of ${SIGNUP_STEPS.length}`} title={COPY[step][0]} body={COPY[step][1]} />
            {body()}
            {idx === 0 && <Notice text="Practice sign up. No real account, SMS or email is created, and nothing you type is stored." />}
          </React.Fragment>
      </StepTransition>
      <CountrySheet open={sheet === 'country'} value={draft.country} onClose={() => setSheet(null)}
        onSelect={name => { set('country')(name); setSheet(null); }} />
      <CallingCodeSheet open={sheet === 'calling'} value={draft.phoneCountry} onClose={() => setSheet(null)}
        onSelect={code => { set('phoneCountry')(code); setSheet(null); }} />
    </Shell>
  );
}
