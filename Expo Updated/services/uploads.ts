import { Platform } from 'react-native';
import { File } from 'expo-file-system';

const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const extensionType = (name: string) => {
  const extension = name.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
  return extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg'
    : extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : '';
};
type ImageInput = { uri: string; name: string; mimeType?: string; file?: Blob };

/** SDK 58's default fetch rejects RN's old {uri,name,type} FormData parts. */
export async function appendImage(form: FormData, field: string, file: ImageInput, maxBytes?: number) {
  if (!file.uri || !file.name) throw new Error('Select the image again.');
  const validate = (size: number, detectedType: string) => {
    const type = (file.mimeType || (detectedType.startsWith('image/') ? detectedType : '')
      || extensionType(file.name) || extensionType(file.uri)).toLowerCase();
    if (!TYPES.has(type)) throw new Error('Choose a JPG, PNG or WEBP image.');
    if (!Number.isFinite(size) || size <= 0) throw new Error(`Could not read ${file.name}. Select it again.`);
    if (maxBytes && size > maxBytes) throw new Error('Choose an image under 5 MB.');
    return type;
  };
  if (Platform.OS === 'web') {
    let blob = file.file;
    if (!blob) {
      const response = await fetch(file.uri);
      if (!response.ok) throw new Error(`Could not read ${file.name}. Please select it again.`);
      blob = await response.blob();
    }
    const type = validate(blob.size, blob.type);
    form.append(field, blob.type === type ? blob : blob.slice(0, blob.size, type), file.name);
  } else {
    const source = new File(file.uri);
    if (!source.exists) throw new Error(`Could not read ${file.name}. Select it again.`);
    const type = validate(source.size, source.type);
    // Expo's multipart encoder explicitly supports byte-readable File parts.
    // Wrap metadata instead of renaming/moving the user's original file.
    // Do not construct RN Blob from an ArrayBuffer: that constructor rejects binary data.
    form.append(field, { name: file.name, type, bytes: () => source.bytes() } as unknown as Blob);
  }
}
