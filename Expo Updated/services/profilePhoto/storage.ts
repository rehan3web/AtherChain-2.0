import type { PhotoStorage } from './types';

const NAME = 'ather-profile-photos-v1';
const urls = new Map<string, { source: string; uri: string }>();
function key(owner: string) {
  return `${window.location.origin}/__local-profile-photo__/${encodeURIComponent(owner)}`;
}
async function bucket() {
  if (typeof caches === 'undefined') throw new Error('Local photo storage is unavailable in this browser.');
  return caches.open(NAME);
}
function localUrl(owner: string, source: string, blob: Blob) {
  const previous = urls.get(owner);
  if (previous) URL.revokeObjectURL(previous.uri);
  const uri = URL.createObjectURL(blob);
  urls.set(owner, { source, uri });
  return uri;
}
function valid(blob: Blob) {
  if (!blob.type.startsWith('image/') || blob.size <= 0 || blob.size > 5 * 1024 * 1024)
    throw new Error('The profile photo file is empty, invalid or over 5 MB.');
}
export const photoStorage: PhotoStorage = {
  async get(owner) {
    const response = await (await bucket()).match(key(owner));
    if (!response) return null;
    const encodedSource = response.headers.get('x-profile-photo-source');
    if (!encodedSource) return null;
    let source: string;
    try { source = decodeURIComponent(encodedSource); } catch { return null; }
    const blob = await response.blob();
    if (!blob.type.startsWith('image/') || blob.size <= 0 || blob.size > 5 * 1024 * 1024) return null;
    return { source, uri: urls.get(owner)?.source === source ? urls.get(owner)!.uri : localUrl(owner, source, blob) };
  },
  async put(owner, source, input) {
    let blob = input?.file;
    if (!blob) {
      const response = await fetch(input?.uri ?? source);
      if (!response.ok) throw new Error('Could not download the profile photo.');
      blob = await response.blob();
    }
    valid(blob);
    await (await bucket()).put(key(owner), new Response(blob, {
      headers: { 'Content-Type': blob.type, 'x-profile-photo-source': encodeURIComponent(source) },
    }));
    return localUrl(owner, source, blob);
  },
  async remove(owner) {
    await (await bucket()).delete(key(owner));
    const previous = urls.get(owner);
    if (previous) URL.revokeObjectURL(previous.uri);
    urls.delete(owner);
  },
};
