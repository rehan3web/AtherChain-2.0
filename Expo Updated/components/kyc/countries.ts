import english from 'i18n-iso-countries/langs/en.json';

// Import only static data: the package's Node entry dynamically requires locales,
// which Metro cannot resolve during server rendering.
export const COUNTRIES = Object.entries(english.countries)
  .map(([code, names]) => ({ code, name: Array.isArray(names) ? names[0] : names }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

export function searchCountries(query: string) {
  const needle = query.trim().toLowerCase();
  return COUNTRIES.filter(item => `${item.name} ${item.code}`.toLowerCase().includes(needle));
}
