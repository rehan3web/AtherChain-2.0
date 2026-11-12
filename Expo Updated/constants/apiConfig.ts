import { Platform } from 'react-native';

/** Expo loads .env and inlines EXPO_PUBLIC_* values when bundling the app. */
export function getApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!configured) {
    throw new Error('Set EXPO_PUBLIC_API_URL in Expo Updated/.env, then restart Expo.');
  }
  if (configured === '/api' && Platform.OS === 'web') return configured;
  try {
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('Invalid API URL');
    }
    return configured;
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL must be a full HTTP(S) backend URL. /api is supported on web only.');
  }
}
