import { Passkey } from 'react-native-passkey';

export async function createCredential(options: any) {
  if (!Passkey.isSupported()) throw new Error('Passkeys require a supported native development or production build.');
  return Passkey.create(options);
}
export async function getCredential(options: any) {
  if (!Passkey.isSupported()) throw new Error('Passkeys require a supported native development or production build.');
  return Passkey.get(options);
}
