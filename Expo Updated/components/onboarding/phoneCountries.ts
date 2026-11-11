import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';
import { COUNTRIES } from '@/components/kyc/countries';

export const PHONE_COUNTRIES = getCountries()
  .map(code => ({
    code,
    name: COUNTRIES.find(country => country.code === code)?.name ?? code,
    dialCode: `+${getCountryCallingCode(code)}`,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

export function getPhoneCountry(code: string) {
  return PHONE_COUNTRIES.find(country => country.code === code);
}

export function searchPhoneCountries(query: string) {
  const needle = query.trim().toLowerCase();
  return PHONE_COUNTRIES.filter(country => `${country.name} ${country.code} ${country.dialCode}`.toLowerCase().includes(needle));
}

export function isPhoneCountry(code: string): code is CountryCode {
  return !!getPhoneCountry(code);
}
