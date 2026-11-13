import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import type { PhotoStorage } from './types';

type Manifest = { source: string; name: string; size: number; md5?: string };
const MAX_BYTES = 5 * 1024 * 1024;
async function location(owner: string) {
  if (!FileSystem.cacheDirectory) throw new Error('Local photo storage is unavailable.');
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, owner);
  return { directory: `${FileSystem.cacheDirectory}profile-photos-v1/${hash}/`, key: `ather:profile-photo:v1:${hash}` };
}
async function manifest(key: string): Promise<Manifest | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return typeof value.source === 'string' && /^photo-[a-zA-Z0-9-]+\.(jpg|png|webp)$/.test(value.name) &&
      Number.isFinite(value.size) && value.size > 0 && value.size <= MAX_BYTES ? value : null;
  } catch { return null; }
}
async function clean(directory: string, keep: string) {
  const files = await FileSystem.readDirectoryAsync(directory);
  await Promise.all(files.filter(name => name !== keep).map(name =>
    FileSystem.deleteAsync(`${directory}${name}`, { idempotent: true })));
}
export const photoStorage: PhotoStorage = {
  async get(owner) {
    const { directory, key } = await location(owner), record = await manifest(key);
    if (!record) return null;
    const uri = directory + record.name;
    const info = await FileSystem.getInfoAsync(uri, { md5: true });
    if (!info.exists || info.isDirectory || info.size !== record.size || (record.md5 && record.md5 !== info.md5)) return null;
    await clean(directory, record.name);
    return { source: record.source, uri };
  },
  async put(owner, source, input) {
    const { directory, key } = await location(owner);
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const extension = source.split(/[?#]/)[0].match(/\.(png|webp|jpe?g)$/i)?.[1]?.toLowerCase() ?? 'jpg';
    const name = `photo-${Crypto.randomUUID()}.${extension === 'jpeg' ? 'jpg' : extension}`, uri = directory + name;
    let committed = false;
    try {
      if (input) await FileSystem.copyAsync({ from: input.uri, to: uri });
      else {
        const result = await FileSystem.downloadAsync(source, uri);
        const contentType = Object.entries(result.headers ?? {}).find(([header]) => header.toLowerCase() === 'content-type')?.[1];
        if (result.status !== 200 || (contentType && !contentType.toLowerCase().startsWith('image/')))
          throw new Error('Could not download the profile photo.');
      }
      const info = await FileSystem.getInfoAsync(uri, { md5: true });
      if (!info.exists || info.isDirectory || info.size <= 0 || info.size > MAX_BYTES)
        throw new Error('The profile photo file is empty, invalid or over 5 MB.');
      const record: Manifest = { source, name, size: info.size, ...(info.md5 ? { md5: info.md5 } : {}) };
      await AsyncStorage.setItem(key, JSON.stringify(record));
      committed = true;
      await clean(directory, name); // Remove the previous photo only after the new copy is committed.
      return uri;
    } catch (error) {
      if (!committed) await FileSystem.deleteAsync(uri, { idempotent: true });
      throw error;
    }
  },
  async remove(owner) {
    const { directory, key } = await location(owner);
    await FileSystem.deleteAsync(directory, { idempotent: true });
    await AsyncStorage.removeItem(key);
  },
};
