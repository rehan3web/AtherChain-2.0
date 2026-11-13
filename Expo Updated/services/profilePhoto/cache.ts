import type { PhotoInput, PhotoStorage, ProfilePhoto } from './types';

/** One serialized cache per account, shared by all avatar components. */
export function createProfilePhotoCache(storage: PhotoStorage, mediaUrl: (path: string) => string, namespace: () => string) {
  const queues = new Map<string, Promise<unknown>>();
  const reads = new Map<string, Promise<string | null>>();
  const updates = new Map<string, { promise: Promise<void>; release: () => void }>();
  const replacements = new Map<string, { version: number; previous: string | null }>();
  const owner = (photo: ProfilePhoto) => `${namespace()}::${photo.userId}`;
  const source = (photo: ProfilePhoto) => photo.url ? mediaUrl(photo.url) : null;
  function enqueue<T>(key: string, work: () => Promise<T>): Promise<T> {
    const task = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(work);
    queues.set(key, task);
    const clean = () => { if (queues.get(key) === task) queues.delete(key); };
    void task.then(clean, clean);
    return task;
  }
  function beginUpdate(photo: ProfilePhoto) {
    const key = owner(photo);
    if (updates.has(key)) throw new Error('A profile photo update is already in progress.');
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    const update = { promise, release };
    updates.set(key, update);
    return () => {
      if (updates.get(key) === update) { updates.delete(key); release(); }
    };
  }
  async function install(photo: ProfilePhoto, imageUrl: string, input: PhotoInput) {
    const key = owner(photo), url = mediaUrl(imageUrl);
    return enqueue(key, async () => {
      const uri = await storage.put(key, url, input);
      replacements.set(key, { version: (replacements.get(key)?.version ?? 0) + 1, previous: source(photo) });
      return uri;
    });
  }
  function resolve(photo: ProfilePhoto, force = false): Promise<string | null> {
    const key = owner(photo), url = source(photo);
    const readKey = JSON.stringify([key, url, force]);
    const existing = reads.get(readKey);
    if (existing) return existing;
    const version = replacements.get(key)?.version ?? 0;
    const task = (updates.get(key)?.promise ?? Promise.resolve()).then(() => enqueue(key, async () => {
      const replacement = replacements.get(key);
      // An old/null metadata read waiting during upload must not delete its newly saved photo.
      if (replacement && replacement.version !== version && replacement.previous === url)
        return (await storage.get(key))?.uri ?? null;
      if (!url) { await storage.remove(key); return null; }
      if (!force) {
        const cached = await storage.get(key);
        if (cached?.source === url) return cached.uri;
      }
      return storage.put(key, url);
    }));
    reads.set(readKey, task);
    const clean = () => { if (reads.get(readKey) === task) reads.delete(readKey); };
    void task.then(clean, clean);
    return task;
  }
  return { beginUpdate, install, resolve };
}
