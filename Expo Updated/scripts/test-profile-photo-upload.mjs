import test from 'node:test';
import assert from 'node:assert/strict';
import { load, hooks, deferred, byId, byType } from './auth-test-utils.mjs';

const identity = { userId: 'account-one', url: '/old.png' };
function uploadHarness({ canceled = false, fail = false, cacheFailure = false, picker, upload } = {}) {
  const h = hooks(), calls = [], toasts = [];
  const photo = { ...identity };
  const module = load('../hooks/useProfilePhotoUpload.ts', {
    react: h.react,
    'expo-image-picker': { launchImageLibraryAsync: async options => {
      calls.push(['pick', options]);
      return picker ? picker.promise : canceled ? { canceled: true } : {
        canceled: false, assets: [{ uri: 'file:///picked.png', fileName: 'chosen.png', type: 'image', mimeType: 'image/png' }],
      };
    } },
    '@/services/api': { userApi: { uploadProfileImage: async form => {
      calls.push(['upload', form]);
      if (fail) throw Error('Server rejected upload');
      if (upload) await upload.promise;
      return { imageUrl: '/new.png' };
    } } },
    '@/services/uploads': { appendImage: async (_form, field, input, limit) => calls.push(['append', field, input, limit]) },
    '@/services/profilePhoto': { profilePhotoCache: {
      beginUpdate: () => { calls.push(['begin']); return () => calls.push(['release']); },
      install: async (_identity, url, input) => {
        calls.push(['cache', url, input]); if (cacheFailure) throw Error('Local storage unavailable');
      },
    } },
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast: toast => toasts.push(toast) }) },
  }, { FormData, Error });
  return { calls, toasts, photo, render: () => h.render(() => module.useProfilePhotoUpload(photo)), unmount: h.unmount };
}
test('picker upload uses the backend image field and commits the selected local photo after server success', async () => {
  const app = uploadHarness();
  await app.render().selectPhoto();
  assert.deepEqual(app.calls.map(call => call[0]), ['pick', 'append', 'begin', 'upload', 'cache', 'release']);
  assert.equal(app.calls[0][1].mediaTypes[0], 'images');
  assert.equal(app.calls[1][1], 'image'); assert.equal(app.calls[1][3], 5 * 1024 * 1024);
  assert.equal(app.calls[4][1], '/new.png');
  assert.equal(app.calls[4][2].uri, 'file:///picked.png');
  assert.equal(app.toasts[0].kind, 'success');
  assert.equal(app.render().busy, false);
});
test('cancel leaves backend and local photo untouched', async () => {
  const app = uploadHarness({ canceled: true });
  await app.render().selectPhoto();
  assert.deepEqual(app.calls.map(call => call[0]), ['pick']);
  assert.equal(app.toasts.length, 0); assert.equal(app.render().busy, false);
});
test('upload failure does not replace local photo, releases the gate and permits retry', async () => {
  const app = uploadHarness({ fail: true });
  await app.render().selectPhoto();
  assert.equal(app.calls.some(call => call[0] === 'cache'), false);
  assert.equal(app.calls.at(-1)[0], 'release');
  assert.equal(app.toasts[0].kind, 'error'); assert.equal(app.render().busy, false);
  await app.render().selectPhoto();
  assert.equal(app.calls.filter(call => call[0] === 'pick').length, 2);
});
test('local storage failure reports that backend upload succeeded rather than claiming nothing was saved', async () => {
  const app = uploadHarness({ cacheFailure: true });
  await app.render().selectPhoto();
  assert.match(app.toasts[0].title, /uploaded, local cache/);
  assert.equal(app.calls.at(-1)[0], 'release');
});
test('duplicate taps are blocked while uploading and the pencil exposes its busy state', async () => {
  const upload = deferred(), app = uploadHarness({ upload });
  const first = app.render().selectPhoto();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(app.render().busy, true);
  await app.render().selectPhoto();
  assert.equal(app.calls.filter(call => call[0] === 'pick').length, 1);
  upload.resolve(); await first; assert.equal(app.render().busy, false);
});
test('leaving the account while the picker is open prevents an upload', async () => {
  const picker = deferred(), app = uploadHarness({ picker });
  const pending = app.render().selectPhoto();
  app.unmount();
  picker.resolve({ canceled: false, assets: [{ uri: 'file:///picked.png' }] });
  await pending;
  assert.equal(app.calls.some(call => call[0] === 'upload'), false);
});

test('avatar decoder failure performs one repair download, then exposes a manual retry instead of looping', async () => {
  const h = hooks(), calls = [];
  const module = load('../hooks/useProfilePhoto.ts', {
    react: h.react, '@/services/profilePhoto': { profilePhotoCache: {
      resolve: async (_photo, force) => { calls.push(force); return `file:///photo-${calls.length}.png`; },
    } },
  }, { Error });
  const render = () => h.render(() => module.useProfilePhoto(identity));
  render(); await new Promise(resolve => setImmediate(resolve));
  render().onImageError(); await new Promise(resolve => setImmediate(resolve));
  render().onImageError();
  assert.deepEqual(calls, [false, true]); assert.ok(render().error);
  render().retry(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [false, true, true]);
});
test('switching accounts immediately hides the previous local avatar and ignores its late response', async () => {
  const h = hooks(), pending = deferred();
  let photo = identity;
  const module = load('../hooks/useProfilePhoto.ts', {
    react: h.react, '@/services/profilePhoto': { profilePhotoCache: {
      resolve: async account => account.userId === 'account-one' ? pending.promise : 'file:///second.png',
    } },
  });
  const render = () => h.render(() => module.useProfilePhoto(photo));
  render(); photo = { userId: 'account-two', url: '/second.png' };
  assert.equal(render().uri, null);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(render().uri, 'file:///second.png');
  pending.resolve('file:///first.png'); await new Promise(resolve => setImmediate(resolve));
  assert.equal(render().uri, 'file:///second.png');
});

test('Settings pencil selects a photo; personal information keeps its separate editing entry', () => {
  const h = hooks();
  let picked = 0;
  const { SettingsScreen } = load('../components/settings/SettingsScreen.tsx', {
    react: h.react, 'react-native': { ...h.native, Platform: { OS: 'web' } },
    '@expo/vector-icons': { Feather: 'Feather' }, 'expo-router': { router: {} },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/hooks/useColors': { useColors: () => ({}) },
    '@/components/profile/ProfileAvatar': { ProfileAvatar: 'ProfileAvatar' },
    '@/hooks/useProfilePhotoUpload': { useProfilePhotoUpload: () => ({ busy: false, selectPhoto: () => { picked++; } }) },
    '@/components/wallet/Sheet': { Sheet: 'Sheet' },
    '@/components/navigation/GlassDock': { useDockClearance: () => ({ clearance: 100 }) },
    './profile': { useProfile: () => ({ profile: { name: 'Fixture', username: 'fixture' }, photo: identity, loading: false }) },
    './ProfileForm': { ProfileForm: 'ProfileForm' }, './InfoDetail': { INFO: {}, InfoDetail: 'InfoDetail' },
    './AppearancePanel': { AppearancePanel: 'AppearancePanel' }, '@/components/kyc/parts': { PrimaryButton: 'PrimaryButton' },
    './KycBadge': { KycBadge: 'KycBadge' },
    '@/components/onboarding/session': { logoutDemo() {} },
  });
  let tree = h.render(SettingsScreen);
  byId(tree, 'settings-edit-profile').props.onPress();
  tree = h.render(SettingsScreen);
  assert.equal(picked, 1); assert.equal(byType(tree, 'ProfileForm'), undefined);
  byId(tree, 'settings-row-personal').props.onPress();
  tree = h.render(SettingsScreen);
  assert.ok(byType(tree, 'ProfileForm'));
});
