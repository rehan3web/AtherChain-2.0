import type { View } from 'react-native';
import type { ComponentRef } from 'react';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

/** Capture the full receipt content view, including rows below the screen. */
export async function shareReceiptImage(target: ComponentRef<typeof View>, _filename: string): Promise<'shared'> {
  if (!await Sharing.isAvailableAsync()) throw new Error('Image sharing is not available on this device.');
  const uri = await captureRef(target, { format: 'png', result: 'tmpfile', quality: 1 });
  try {
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share receipt image' });
    return 'shared';
  } finally {
    releaseCapture(uri);
  }
}
