import type { View } from 'react-native';
import type { ComponentRef } from 'react';
import { toBlob } from 'html-to-image';

/** Browser implementation. Only a PNG file is shared, never receipt text. */
export async function shareReceiptImage(target: ComponentRef<typeof View>, filename: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const node = target as unknown as HTMLElement;
  await document.fonts.ready;
  // Metro serves different fonts/images under /assets/?unstable_path=...
  // Dropping queries merges their cache entries and corrupts receipt fonts.
  const blob = await toBlob(node, { pixelRatio: 2, includeQueryParams: true });
  if (!blob || blob.size === 0) throw new Error('Could not create the receipt image. Please retry.');
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try { await navigator.share({ files: [file] }); return 'shared'; }
    catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
      throw error;
    }
  }
  // Browsers without image-file sharing still receive an actual receipt PNG.
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  return 'downloaded';
}
