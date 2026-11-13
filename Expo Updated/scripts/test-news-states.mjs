import test from 'node:test';
import assert from 'node:assert/strict';
import { load, hooks, byId, byType, nodes } from './auth-test-utils.mjs';

function screen(list = async () => ({ posts: [] })) {
  const h = hooks(), media = [];
  let loader;
  const resource = { data: null, loading: true, error: null, async reload() {
    resource.loading = true; resource.error = null;
    try { resource.data = await loader(); }
    catch (error) { resource.error = error.message; resource.data = null; }
    finally { resource.loading = false; }
  } };
  const { NewsScreen } = load('../components/news/NewsScreen.tsx', {
    react: h.react, 'react-native': { ...h.native, FlatList: 'FlatList' },
    '@expo/vector-icons': { Feather: 'Feather' }, 'expo-router': { router: {} },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/hooks/useColors': { useColors: () => ({}) }, './NewsPost': { NewsPost: 'NewsPost' },
    '@/services/api': { newsApi: { list }, getMediaUrl: value => { media.push(value); return `https://example.test${value}`; } },
    '@/hooks/useBackendResource': { useBackendResource: callback => { loader = callback; return resource; } },
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast() {} }) },
    '@/components/KeyboardAwareScrollViewCompat': { KeyboardAwareScrollViewCompat: 'Scroll' },
    '@/components/BackendScreenState': { BackendScreenState: 'BackendScreenState' },
  });
  const render = () => h.render(NewsScreen);
  render();
  return { resource, media, render, empty: () => byId(render(), 'news-feed').props.ListEmptyComponent };
}
test('empty backend news shows a clear message instead of a blank feed', async () => {
  const app = screen();
  await app.resource.reload();
  const empty = app.empty();
  assert.ok(byId(empty, 'news-empty'));
  assert.ok(nodes(empty).some(node => node.props.children?.includes('No news available')));
  assert.equal(byId(app.render(), 'news-feed').props.data.length, 0);
});
test('pending requests show loading, not an early empty-news message', () => {
  const app = screen();
  assert.equal(app.empty().props.testID, 'news-status');
  assert.equal(app.empty().props.error, null);
  assert.equal(byId(app.empty(), 'news-empty'), undefined);
});
test('failed news request offers retry, and a recovered empty response shows empty news', async () => {
  let calls = 0;
  const app = screen(async () => {
    if (++calls === 1) throw Error('News unavailable');
    return { posts: [] };
  });
  await app.resource.reload();
  assert.equal(app.empty().props.error, 'News unavailable');
  app.empty().props.onRetry();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.ok(byId(app.empty(), 'news-empty'));
});
test('news mapping omits missing, null, empty and whitespace images without dropping posts', async () => {
  const app = screen(async () => ({ posts: [
    { id: 1 }, { id: 2, image_url: null }, { id: 3, image_url: '' },
    { id: 4, image_url: '   ' }, { id: 5, image_url: ' /news/photo.jpg ' },
  ] }));
  await app.resource.reload();
  assert.equal(app.resource.data.length, 5);
  assert.ok(app.resource.data.slice(0, 4).every(post => post.image === undefined));
  assert.equal(app.resource.data[4].image.uri, 'https://example.test/news/photo.jpg');
  assert.deepEqual(app.media, ['/news/photo.jpg']);
});
function postFixture(image) {
  const h = hooks();
  const { NewsPost } = load('../components/news/NewsPost.tsx', {
    react: h.react, 'react-native': h.native, 'expo-image': { Image: 'Image' },
    '@expo/vector-icons': { Feather: 'Feather' }, '@/hooks/useColors': { useColors: () => ({}) },
  });
  const post = { id: 'fixture', category: 'News', title: 'Update', description: 'News body', image };
  return { post, render: () => h.render(() => NewsPost({ post })) };
}
test('text-only news posts have no image, image box or unavailable-image placeholder', () => {
  for (const image of [undefined, null, {}, { uri: '' }, { uri: '   ' }]) {
    const app = postFixture(image);
    const tree = app.render();
    assert.ok(byId(tree, 'news-post-fixture'));
    assert.equal(byType(tree, 'Image'), undefined);
    assert.equal(nodes(tree).some(node => node.props.accessibilityRole === 'alert'), false);
    assert.ok(nodes(tree).some(node => node.props.children?.includes('News body')));
  }
});
test('news with an image retains rendering and error feedback; replacing it recovers the image', () => {
  const app = postFixture({ uri: 'https://example.test/photo.jpg' });
  byType(app.render(), 'Image').props.onError();
  assert.equal(byType(app.render(), 'Image'), undefined);
  assert.ok(nodes(app.render()).some(node => node.props.children?.includes('Image unavailable')));
  app.post.image = undefined;
  assert.equal(nodes(app.render()).some(node => node.props.accessibilityRole === 'alert'), false);
  app.post.image = { uri: 'https://example.test/new.jpg' };
  app.render();
  assert.equal(byType(app.render(), 'Image').props.source.uri, 'https://example.test/new.jpg');
});
