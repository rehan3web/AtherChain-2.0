import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { load } from './auth-test-utils.mjs';

const { createProfilePhotoCache } = load('../services/profilePhoto/cache.ts');
const photo = { userId: 'account-one', url: '/uploads/one.png' };
const input = { uri: 'file:///picker/selected.png' };
const factory = storage => createProfilePhotoCache(storage, path => `https://api.test${path}`, () => 'https://api.test');
function storageFixture() {
  const records = new Map(), calls = [];
  let serial = 0;
  return { records, calls, storage: {
    async get(owner) { return records.get(owner) ?? null; },
    async put(owner, source, picked) {
      calls.push(picked ? 'copy' : 'download');
      const uri = `file:///cached-${++serial}.png`;
      records.set(owner, { source, uri }); return uri;
    },
    async remove(owner) { calls.push('remove'); records.delete(owner); },
  } };
}
test('avatar components share one download; cached images are reused across new app instances', async () => {
  const f = storageFixture(), cache = factory(f.storage);
  const first = await Promise.all([cache.resolve(photo), cache.resolve(photo)]);
  assert.equal(first[0], first[1]); assert.deepEqual(f.calls, ['download']);
  assert.equal(await factory(f.storage).resolve(photo), first[0]);
  assert.deepEqual(f.calls, ['download']);
});
test('successful upload installs the selected photo without downloading it again, replacing the previous cache', async () => {
  const f = storageFixture(), cache = factory(f.storage);
  const old = await cache.resolve(photo);
  const finish = cache.beginUpdate(photo);
  const installed = await cache.install(photo, '/uploads/two.png', input);
  finish();
  assert.notEqual(installed, old);
  assert.equal(await cache.resolve({ ...photo, url: '/uploads/two.png' }), installed);
  assert.deepEqual(f.calls, ['download', 'copy']);
  assert.equal(f.records.size, 1);
});
test('metadata reads wait for upload caching instead of fetching the newly uploaded image', async () => {
  const f = storageFixture(), cache = factory(f.storage);
  const finish = cache.beginUpdate(photo);
  const pending = cache.resolve({ ...photo, url: '/uploads/two.png' });
  await cache.install(photo, '/uploads/two.png', input);
  finish(); await pending;
  assert.deepEqual(f.calls, ['copy']);
});
test('an old empty metadata read waiting during upload cannot delete the committed photo', async () => {
  const f = storageFixture(), cache = factory(f.storage), empty = { ...photo, url: null };
  const finish = cache.beginUpdate(empty), pending = cache.resolve(empty);
  const saved = await cache.install(empty, '/uploads/two.png', input);
  finish();
  assert.equal(await pending, saved);
  assert.deepEqual(f.calls, ['copy']);
});
test('cache misses and decoder repair fetch again; different accounts never share a photo', async () => {
  const f = storageFixture(), cache = factory(f.storage);
  await cache.resolve(photo);
  f.records.clear(); await cache.resolve(photo);
  await Promise.all([cache.resolve(photo, true), cache.resolve(photo, true)]);
  await cache.resolve({ ...photo, userId: 'account-two' });
  assert.deepEqual(f.calls, ['download', 'download', 'download', 'download']);
  assert.equal(f.records.size, 2);
});
test('backend removal clears the local photo and failures remain retryable', async () => {
  const f = storageFixture(), cache = factory(f.storage);
  await cache.resolve(photo);
  await cache.resolve({ ...photo, url: null });
  assert.equal(f.records.size, 0);
  let count = 0;
  const broken = factory({ ...f.storage, put: async () => {
    if (++count === 1) throw Error('offline');
    return 'file:///recovered.png';
  } });
  await assert.rejects(broken.resolve(photo), /offline/);
  assert.equal(await broken.resolve(photo), 'file:///recovered.png');
});

function nativeFixture() {
  const files = new Map([[input.uri, Buffer.from('selected-image')]]), values = new Map(), downloads = [];
  let sequence = 0, rejectMetadata = false;
  const dependencies = {
    '@react-native-async-storage/async-storage': {
      getItem: async key => values.get(key) ?? null,
      setItem: async (key, value) => { if (rejectMetadata) throw Error('Storage full'); values.set(key, value); },
      removeItem: async key => { values.delete(key); },
    },
    'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'sha256' },
      digestStringAsync: async (_kind, value) => createHash('sha256').update(value).digest('hex'),
      randomUUID: () => `fixture-${++sequence}` },
    'expo-file-system/legacy': {
      cacheDirectory: 'file:///cache/', makeDirectoryAsync: async () => {},
      getInfoAsync: async uri => files.has(uri)
        ? { exists: true, isDirectory: false, size: files.get(uri).length, md5: createHash('md5').update(files.get(uri)).digest('hex') }
        : { exists: false },
      readDirectoryAsync: async directory => [...files.keys()].filter(path => path.startsWith(directory)).map(path => path.slice(directory.length)),
      copyAsync: async ({ from, to }) => { if (!files.has(from)) throw Error('Missing selected file'); files.set(to, Buffer.from(files.get(from))); },
      deleteAsync: async uri => { for (const path of files.keys()) if (path === uri || path.startsWith(uri)) files.delete(path); },
      downloadAsync: async (source, uri) => { downloads.push(source); files.set(uri, Buffer.from('backend-image'));
        return { status: 200, headers: { 'Content-Type': 'image/png' } }; },
    },
  };
  const reload = () => load('../services/profilePhoto/storage.native.ts', dependencies).photoStorage;
  return { files, values, downloads, reload, failMetadata: () => { rejectMetadata = true; } };
}
test('native cache persists across restart and uses local file existence, size and checksum before downloading', async () => {
  const f = nativeFixture(), first = factory(f.reload());
  const uri = await first.resolve(photo);
  assert.equal(await factory(f.reload()).resolve(photo), uri);
  assert.equal(f.downloads.length, 1);
  f.files.delete(uri);
  const replacement = await first.resolve(photo);
  assert.notEqual(replacement, uri); assert.equal(f.downloads.length, 2);
  f.files.set(replacement, Buffer.from('corrupted!!!!')); // Nonempty corruption must not be accepted.
  await first.resolve(photo);
  assert.equal(f.downloads.length, 3);
});
test('native update keeps exactly one owned copy and never deletes the selected gallery source', async () => {
  const f = nativeFixture(), cache = factory(f.reload());
  const original = await cache.resolve(photo);
  const uri = await cache.install(photo, '/uploads/two.png', input);
  assert.equal(f.files.has(original), false);
  assert.equal(f.files.has(uri), true);
  assert.equal(f.files.has(input.uri), true);
  assert.equal([...f.files.keys()].filter(path => path.startsWith('file:///cache/')).length, 1);
  assert.equal(f.downloads.length, 1);
});
test('native storage failure removes the unfinished candidate and preserves the previous photo', async () => {
  const f = nativeFixture(), cache = factory(f.reload());
  const previous = await cache.resolve(photo);
  f.failMetadata();
  await assert.rejects(cache.install(photo, '/uploads/two.png', input), /Storage full/);
  assert.equal(f.files.has(previous), true);
  assert.equal([...f.files.keys()].filter(path => path.startsWith('file:///cache/')).length, 1);
});
test('native backend removal deletes owned files and metadata, not another account or gallery files', async () => {
  const f = nativeFixture(), cache = factory(f.reload());
  const first = await cache.resolve(photo), second = await cache.resolve({ ...photo, userId: 'account-two' });
  await cache.resolve({ ...photo, url: null });
  assert.equal(f.files.has(first), false); assert.equal(f.files.has(second), true);
  assert.equal(f.files.has(input.uri), true); assert.equal(f.values.size, 1);
});

function browserFixture() {
  const entries = new Map(), revoked = [], downloads = [];
  let sequence = 0;
  const globals = { window: { location: { origin: 'https://app.test' } }, Blob, Response,
    caches: { open: async () => ({
      match: async key => entries.get(key)?.clone(), put: async (key, response) => { entries.set(key, response); },
      delete: async key => entries.delete(key),
    }) },
    URL: { createObjectURL: () => `blob:local-${++sequence}`, revokeObjectURL: uri => revoked.push(uri) },
    fetch: async uri => { downloads.push(uri); return new Response(new Blob(['fixture'], { type: 'image/png' })); },
  };
  return { entries, revoked, downloads, reload: () => load('../services/profilePhoto/storage.ts', {}, globals).photoStorage };
}
test('browser photo cache survives restart without fetching and replaces old blobs/object URLs', async () => {
  const f = browserFixture(), storage = f.reload(), blob = new Blob(['chosen'], { type: 'image/png' });
  const old = await storage.put('owner', 'source-one', { uri: 'blob:picker', file: blob });
  await f.reload().get('owner'); assert.equal(f.downloads.length, 0);
  const updated = await storage.put('owner', 'source-two', { uri: 'blob:picker', file: blob });
  assert.notEqual(updated, old); assert.ok(f.revoked.includes(old)); assert.equal(f.entries.size, 1);
  await storage.remove('owner'); assert.equal(f.entries.size, 0);
});
test('invalid browser cache entries are treated as misses and replaced from the backend', async () => {
  const f = browserFixture(), storage = f.reload();
  await storage.put('owner', 'source', { uri: 'blob:picker', file: new Blob(['image'], { type: 'image/png' }) });
  const key = [...f.entries.keys()][0];
  f.entries.set(key, new Response('broken', { headers: { 'Content-Type': 'text/html', 'x-profile-photo-source': 'source' } }));
  assert.equal(await storage.get('owner'), null);
  await storage.put('owner', 'source');
  assert.deepEqual(f.downloads, ['source']);
});
