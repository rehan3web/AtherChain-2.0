import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

/** Check the actual web copy result; the Expo legacy fallback can report false success. */
export async function copyText(text: string): Promise<void> {
  if (Platform.OS !== 'web') {
    if (!await Clipboard.setStringAsync(text)) throw new Error('Clipboard unavailable');
    return;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // A browser may still allow a user-initiated legacy copy.
  }
  const previous = document.activeElement;
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  try {
    field.select();
    if (!document.execCommand('copy')) throw new Error('Clipboard unavailable');
  } finally {
    field.remove();
    if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
  }
}
