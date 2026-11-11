import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { AppInput } from '@/components/auth/AppInput';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { ProgressBar } from '@/components/auth/ProgressBar';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';
import { OtpInput } from '@/components/auth/OtpInput';
import { CountrySelector, Country } from '@/components/auth/CountrySelector';
import { PhoneInput, DialCountry, getDialCountryByCode, isValidPhone } from '@/components/auth/PhoneInput';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

const TOTAL_STEPS = 7;
const { width } = Dimensions.get('window');

interface FormData {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  referralCode: string;
  country?: Country;
  dialCountry: DialCountry;
  phoneNumber: string;
  otp: string[];
}

interface Errors {
  email?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  phoneNumber?: string;
  otp?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

const RESEND_SECONDS = 30;

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { signUp, verifyEmail, resendOtp, pendingEmail } = useAuth();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    referralCode: '',
    dialCountry: getDialCountryByCode('US'),
    phoneNumber: '',
    otp: Array(6).fill(''),
  });
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // OTP resend timer
  const [resendCooldown, setResendCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startResendTimer = () => {
    setResendCooldown(RESEND_SECONDS);
    timerRef.current = setInterval(() => {
      setResendCooldown(s => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (step === 7) startResendTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step]);

  // Step animation
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const animateToStep = (newStep: number, direction: 'forward' | 'backward') => {
    const outX = direction === 'forward' ? -(width * 0.35) : width * 0.35;
    const inX = direction === 'forward' ? width * 0.35 : -(width * 0.35);
    translateX.value = withTiming(outX, { duration: 210 });
    opacity.value = withTiming(0, { duration: 175 }, () => {
      runOnJS(setStep)(newStep);
      translateX.value = inX;
      translateX.value = withTiming(0, { duration: 210 });
      opacity.value = withTiming(1, { duration: 210 });
    });
  };

  const update = (key: keyof FormData, val: string) =>
    setForm(f => ({ ...f, [key]: val }));

  const validateStep = (): boolean => {
    const errs: Errors = {};
    if (step === 1) {
      if (!form.email.trim()) errs.email = 'Email is required';
      else if (!isValidEmail(form.email)) errs.email = 'Enter a valid email address';
    }
    if (step === 2) {
      if (!form.username.trim()) errs.username = 'Username is required';
      if (!form.password) errs.password = 'Password is required';
      else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
      if (!form.confirmPassword) errs.confirmPassword = 'Please confirm your password';
      else if (form.password !== form.confirmPassword)
        errs.confirmPassword = 'Passwords do not match';
    }
    if (step === 3) {
      if (!form.firstName.trim()) errs.firstName = 'First name is required';
      if (!form.lastName.trim()) errs.lastName = 'Last name is required';
    }
    if (step === 5) {
      if (!form.country) errs.country = 'Please select your country';
    }
    if (step === 6) {
      if (!form.phoneNumber.trim()) errs.phoneNumber = 'Phone number is required';
      else if (!isValidPhone(form.phoneNumber)) errs.phoneNumber = 'Enter a valid phone number (4–15 digits)';
    }
    if (step === 7) {
      const code = form.otp.join('');
      if (code.length < 6) errs.otp = 'Enter the 6-digit code sent to your email';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = async () => {
    if (!validateStep()) return;

    if (step === 6) {
      setLoading(true);
      const res = await signUp({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        phone: `${form.dialCountry.dial}${form.phoneNumber.trim()}`,
        password: form.password,
        referralCode: form.referralCode.trim() || undefined,
        country: form.country?.name || form.dialCountry.name,
      });
      setLoading(false);
      if (res.success) {
        animateToStep(7, 'forward');
      } else {
        toast(res.error || "Registration failed", "error");
      }
      return;
    }

    if (step === 7) {
      const code = form.otp.join('');
      setLoading(true);
      const res = await verifyEmail(pendingEmail || form.email, code);
      setLoading(false);
      if (res.success) {
        router.replace('/(tabs)' as any);
      } else {
        setErrors({ otp: res.error || 'Invalid code. Please try again.' });
      }
      return;
    }

    animateToStep(step + 1, 'forward');
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setErrors({ ...errors, otp: undefined });
    try {
      await resendOtp(pendingEmail || form.email);
      toast("Verification code resent", "success");
      startResendTimer();
    } catch {
      setErrors({ ...errors, otp: 'Failed to resend. Try again.' });
    } finally {
      setResendLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 1) {
      router.back();
    } else {
      setErrors({});
      animateToStep(step - 1, 'backward');
    }
  };

  const stepTitles = [
    'Create account',
    'Your credentials',
    "What's your name?",
    'Referral code',
    'Where are you from?',
    'Phone number',
    'Verify your email',
  ];
  const stepSubtitles = [
    'Enter your email to get started',
    'Choose a username and a strong password',
    'Tell us a bit about yourself',
    'Have a referral code? Enter it here',
    'Select your country of residence',
    'Enter your phone number for verification',
    `We sent a 6-digit code to ${pendingEmail || form.email || 'your email'}`,
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.progressWrapper}>
          <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />
        </View>
        <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>
          {step}/{TOTAL_STEPS}
        </Text>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <Animated.View style={animatedStyle}>
          <Text style={[styles.title, { color: colors.text }]}>
            {stepTitles[step - 1]}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {stepSubtitles[step - 1]}
          </Text>

          {/* Step 1: Email */}
          {step === 1 && (
            <AppInput
              placeholder="Email address"
              value={form.email}
              onChangeText={t => update('email', t)}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={handleNext}
            />
          )}

          {/* Step 2: Credentials */}
          {step === 2 && (
            <>
              <AppInput
                placeholder="Username"
                value={form.username}
                onChangeText={t => update('username', t)}
                error={errors.username}
                autoCapitalize="none"
                returnKeyType="next"
              />
              <AppInput
                placeholder="Password"
                value={form.password}
                onChangeText={t => update('password', t)}
                error={errors.password}
                secureTextEntry
                returnKeyType="next"
              />
              <PasswordStrengthMeter password={form.password} />
              <AppInput
                placeholder="Confirm Password"
                value={form.confirmPassword}
                onChangeText={t => update('confirmPassword', t)}
                error={errors.confirmPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleNext}
              />
            </>
          )}

          {/* Step 3: Name */}
          {step === 3 && (
            <>
              <AppInput
                placeholder="First Name"
                value={form.firstName}
                onChangeText={t => update('firstName', t)}
                error={errors.firstName}
                autoCapitalize="words"
                returnKeyType="next"
              />
              <AppInput
                placeholder="Last Name"
                value={form.lastName}
                onChangeText={t => update('lastName', t)}
                error={errors.lastName}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleNext}
              />
            </>
          )}

          {/* Step 4: Referral (optional) */}
          {step === 4 && (
            <>
              <AppInput
                placeholder="Referral Code (optional)"
                value={form.referralCode}
                onChangeText={t => update('referralCode', t)}
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={handleNext}
              />
              <View
                style={[
                  styles.optionalBadge,
                  { backgroundColor: colors.primaryPale, borderColor: colors.primaryNeutral },
                ]}
              >
                <Feather name="info" size={13} color={colors.primary} />
                <Text style={[styles.optionalText, { color: colors.primary }]}>
                  This step is optional — you can skip it
                </Text>
              </View>
            </>
          )}

          {/* Step 5: Country */}
          {step === 5 && (
            <CountrySelector
              value={form.country}
              onSelect={c => setForm(f => ({ ...f, country: c, dialCountry: getDialCountryByCode(c.code) }))}
              error={errors.country}
            />
          )}

          {/* Step 6: Phone Number */}
          {step === 6 && (
            <PhoneInput
              dialCountry={form.dialCountry}
              phoneNumber={form.phoneNumber}
              onDialCountryChange={c => setForm(f => ({ ...f, dialCountry: c }))}
              onPhoneNumberChange={p => setForm(f => ({ ...f, phoneNumber: p }))}
              error={errors.phoneNumber}
            />
          )}

          {/* Step 7: OTP */}
          {step === 7 && (
            <>
              <OtpInput
                length={6}
                value={form.otp}
                onChange={otp => setForm(f => ({ ...f, otp }))}
                autoFocus={true}
              />
              {errors.otp && (
                <Text style={[styles.otpError, { color: colors.destructive }]}>
                  {errors.otp}
                </Text>
              )}
              <View style={styles.resendRow}>
                {resendCooldown > 0 ? (
                  <Text style={[styles.resendCooldown, { color: colors.mutedForeground }]}>
                    Resend code in{' '}
                    <Text style={{ fontWeight: '600', color: colors.text }}>{resendCooldown}s</Text>
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResend} disabled={resendLoading}>
                    <Text style={[styles.resendLink, { color: colors.primary }]}>
                      Resend Code
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </Animated.View>
      </KeyboardAwareScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: bottomPad + 16 }]}>
        <PrimaryButton
          title={step === 7 ? 'Verify & Continue' : 'Next'}
          onPress={handleNext}
          loading={loading}
        />
        {step === 4 && (
          <>
            <View style={styles.gap} />
            <PrimaryButton
              title="Skip"
              onPress={() => animateToStep(5, 'forward')}
              variant="secondary"
            />
          </>
        )}
        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => router.replace('/login' as any)}
        >
          <Text style={[styles.loginText, { color: colors.mutedForeground }]}>
            Already have an account?{' '}
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  backBtn: { width: 32, alignItems: 'center' },
  progressWrapper: { flex: 1 },
  stepLabel: { fontSize: 12, fontWeight: '500', width: 28, textAlign: 'right' },
  scroll: { paddingHorizontal: 24, paddingTop: 4, flexGrow: 1 },
  title: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 8,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 28,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  optionalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  optionalText: { fontSize: 13, fontWeight: '500', flex: 1 },
  resendRow: { alignItems: 'center', marginTop: 16 },
  resendLink: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  resendCooldown: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  otpError: { fontSize: 12, textAlign: 'center', marginTop: -4, marginBottom: 8 },
  footer: { paddingHorizontal: 24, paddingTop: 8 },
  gap: { height: 12 },
  loginLink: { marginTop: 16, alignItems: 'center' },
  loginText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
