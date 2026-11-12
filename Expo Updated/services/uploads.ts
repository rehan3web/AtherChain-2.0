import { Platform } from 'react-native';

/** React Native expects file descriptors; web FormData expects actual Blobs. */
export async function appendImage(form: FormData, field: string, file: { uri: string; name: string }) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const type = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
  if (Platform.OS === 'web') {
    const response = await fetch(file.uri);
    if (!response.ok) throw new Error(`Could not read ${file.name}. Please select it again.`);
    form.append(field, await response.blob(), file.name);
  } else {
    form.append(field, { uri: file.uri, name: file.name, type } as any);
  }
}
