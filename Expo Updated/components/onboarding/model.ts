import { isPossiblePhoneNumber } from 'libphonenumber-js';
import { COUNTRIES } from '@/components/kyc/countries';
import { isPhoneCountry } from './phoneCountries';

export type SignupDraft = {
  identifier: string;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  country: string;
  referral: string;
  phoneCountry: string;
  phone: string;
};
export type SignupStep = 'identifier' | 'username' | 'password' | 'name' | 'country' | 'referral' | 'phone' | 'otp';
export const SIGNUP_STEPS: SignupStep[] = ['identifier', 'username', 'password', 'name', 'country', 'referral', 'phone', 'otp'];
export const EMPTY_SIGNUP: SignupDraft = {
  identifier: '', email: '', username: '', password: '', confirmPassword: '',
  firstName: '', lastName: '', country: '', referral: '', phoneCountry: 'US', phone: '',
};

const usernameValid = (value: string) => /^[a-zA-Z0-9_.]{3,30}$/.test(value);
const emailValid = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const identifierValid = (value: string) => value.includes('@')
  ? emailValid(value)
  : usernameValid(value);


export function getSignupEmail(draft: SignupDraft) {
  return draft.identifier.trim();
}

export function maskSignupEmail(email: string) {
  const [local, domain] = email.split('@');
  return domain ? `${local.slice(0, 1)}•••@${domain}` : 'your email';
}

export function validateSignupStep(step: SignupStep, draft: SignupDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (step === 'identifier' && !emailValid(draft.identifier.trim()))
    errors.identifier = 'Enter a valid email address for your verification code.';
  if (step === 'username' && !usernameValid(draft.username.trim()))
    errors.username = 'Use 3–30 letters, numbers, dots or underscores.';
  if (step === 'password') {
    if (draft.password.trim().length < 8 || draft.password.length > 128)
      errors.password = 'Use a strong password with 8–128 characters.';
    if (!draft.confirmPassword || draft.confirmPassword !== draft.password)
      errors.confirmPassword = 'Passwords must match.';
  }
  if (step === 'name') {
    if (!draft.firstName.trim() || draft.firstName.trim().length > 60)
      errors.firstName = 'Enter a first name with up to 60 characters.';
    if (!draft.lastName.trim() || draft.lastName.trim().length > 60)
      errors.lastName = 'Enter a last name with up to 60 characters.';
  }
  if (step === 'country' && !COUNTRIES.some(country => country.name === draft.country))
    errors.country = 'Choose a country from the list.';
  if (step === 'referral' && draft.referral.trim() && !/^[a-zA-Z0-9_-]{1,32}$/.test(draft.referral.trim()))
    errors.referral = 'Use up to 32 letters, numbers, underscores or hyphens, or skip.';
  if (step === 'phone') {
    if (!isPhoneCountry(draft.phoneCountry)) {
      errors.phoneCountry = 'Choose a country calling code.';
    } else if (!/^[0-9 ()-]{4,24}$/.test(draft.phone.trim()) || !isPossiblePhoneNumber(draft.phone.trim(), draft.phoneCountry)) {
      errors.phone = 'Enter a possible local phone number for the selected country.';
    }
  }
  return errors;
}

export function validateLogin(identifier: string, password: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!identifierValid(identifier.trim()))
    errors.identifier = 'Enter an email address or a username with 3–30 letters, numbers, dots or underscores.';
  if (password.trim().length < 8 || password.length > 128)
    errors.password = 'Enter your password with 8–128 characters.';
  return errors;
}
