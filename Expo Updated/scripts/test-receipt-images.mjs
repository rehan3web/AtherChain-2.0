import test from 'node:test';
import assert from 'node:assert/strict';
import { Blob, File } from 'node:buffer';
import { load, hooks, deferred, byId, nodes } from './auth-test-utils.mjs';

test('native sharing captures a PNG, shares the image file and releases temporary storage', async () => {
  const events = [], dialog = deferred(), opened = deferred(), target = {};
  const api = load('../services/receiptImage.native.ts', {
    'react-native-view-shot': {
      captureRef: async (node, options) => { assert.equal(node, target); events.push(options); return 'file:///receipt.png'; },
      releaseCapture: uri => events.push(['release', uri]),
    },
    'expo-sharing': { isAvailableAsync: async () => true,
      shareAsync: async (uri, options) => { events.push({ uri, ...options }); opened.resolve(); await dialog.promise; } },
  });
  const pending = api.shareReceiptImage(target, 'receipt.png');
  await opened.promise;
  assert.equal(events.length, 2);
  assert.equal(events[0].format, 'png');
  assert.equal(events[0].result, 'tmpfile');
  assert.equal(events[1].mimeType, 'image/png');
  assert.equal(events[1].UTI, 'public.png');
  assert.equal('message' in events[1], false);
  dialog.resolve(); await pending;
  assert.deepEqual(events[2], ['release', 'file:///receipt.png']);
});
test('native share failures clean up the captured image, without a text fallback', async () => {
  let released = false;
  const api = load('../services/receiptImage.native.ts', {
    'react-native-view-shot': { captureRef: async () => 'file:///receipt.png', releaseCapture: () => { released = true; } },
    'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async () => { throw Error('Share failed'); } },
  });
  await assert.rejects(api.shareReceiptImage({}, 'receipt.png'), /Share failed/);
  assert.equal(released, true);
});
function webFixture({ canShare = true, cancel = false, empty = false } = {}) {
  const calls = [], blob = new Blob(['PNG fixture'], { type: 'image/png' });
  const node = { scrollHeight: 1600 };
  const api = load('../services/receiptImage.ts', {
    'html-to-image': { toBlob: async (target, options) => {
      assert.equal(target, node); assert.equal(options.pixelRatio, 2);
      assert.equal(options.includeQueryParams, true);
      assert.equal(options.height, undefined); // Do not crop to viewport height.
      return empty ? null : blob;
    } },
  }, { File, Error, navigator: {
    canShare: () => canShare,
    share: async data => { calls.push(data); if (cancel) { const e = Error('Cancelled'); e.name = 'AbortError'; throw e; } },
  }, document: { fonts: { ready: Promise.resolve() }, body: { appendChild() {} },
    createElement: () => ({ click() { calls.push('download'); }, remove() {} }) },
  URL: { createObjectURL: () => 'blob:fixture', revokeObjectURL() {} }, setTimeout() {} });
  return { api, calls, node };
}
test('browser sharing passes a PNG file, never text or a URL', async () => {
  const app = webFixture();
  assert.equal(await app.api.shareReceiptImage(app.node, 'receipt.png'), 'shared');
  assert.deepEqual(Object.keys(app.calls[0]), ['files']);
  assert.equal(app.calls[0].files[0].name, 'receipt.png');
  assert.equal(app.calls[0].files[0].type, 'image/png');
});
test('unsupported browser file sharing downloads the PNG instead of sharing text', async () => {
  const app = webFixture({ canShare: false });
  assert.equal(await app.api.shareReceiptImage(app.node, 'receipt.png'), 'downloaded');
  assert.deepEqual(app.calls, ['download']);
});
test('cancelling the browser share sheet is not treated as an error or a download', async () => {
  const app = webFixture({ cancel: true });
  assert.equal(await app.api.shareReceiptImage(app.node, 'receipt.png'), 'cancelled');
  assert.equal(app.calls.length, 1);
});
test('image generation failure is explicit and never invokes sharing', async () => {
  const app = webFixture({ empty: true });
  await assert.rejects(app.api.shareReceiptImage(app.node, 'receipt.png'), /Could not create/);
  assert.equal(app.calls.length, 0);
});
test('receipt image hook blocks duplicate taps, resets after errors, and permits retry', async () => {
  const h = hooks(), pending = deferred(), toasts = [];
  let calls = 0;
  const { useReceiptImage } = load('../hooks/useReceiptImage.ts', {
    react: h.react, '@/services/receiptImage': { shareReceiptImage: async () => {
      calls++; if (calls === 1) await pending.promise; return 'shared';
    } }, '@/components/toast/ToastProvider': { useToast: () => ({ showToast: toast => toasts.push(toast) }) },
  });
  const render = () => h.render(() => useReceiptImage('receipt.png'));
  render().receiptRef.current = {};
  const request = render().shareImage();
  assert.equal(render().sharing, true);
  await render().shareImage(); assert.equal(calls, 1);
  pending.reject(Error('Capture failed')); await request;
  assert.equal(render().sharing, false);
  assert.equal(toasts[0].kind, 'error');
  await render().shareImage(); assert.equal(calls, 2);
});
for (const type of ['send', 'swap']) {
  test(`${type} receipt shares its complete content view, excluding header controls`, async () => {
    const h = hooks(), receiptRef = { current: {} };
    let calls = 0;
    const dependencies = {
      react: h.react, 'react-native': { ...h.native, Modal: 'Modal' },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
      '@expo/vector-icons': { Feather: 'Feather' }, '@/utils/clipboard': {},
      '@/hooks/useColors': { useColors: () => ({ miningPage: '#fff' }) },
      './ConfirmedIcon': { ConfirmedIcon: 'ConfirmedIcon' },
      '@/components/toast/ToastProvider': { ToastSurface: 'ToastSurface', useToast: () => ({ showToast() {} }) },
      '@/hooks/useReceiptImage': { useReceiptImage: () => ({ receiptRef, sharing: false, shareImage: async () => { calls++; } }) },
    };
    let tree, prefix;
    if (type === 'send') {
      const module = load('../components/wallet/SendReceipt.tsx', { ...dependencies,
        './SendConfirmation': { SendDetail: 'SendDetail', SEND_METHOD_LABELS: { username: 'Username' } },
        './format': { formatReceiptAmount: () => '2.00 ATH' },
      });
      tree = h.render(() => module.SendReceipt({ receipt: { reference: 'fixture', createdAt: 'fixture date',
        recipient: { method: 'username', value: '@alice' }, amount: 2 }, money: {}, onClose() {} }));
      prefix = 'wallet-send';
    } else {
      const model = load('../components/wallet/swap-model.ts');
      const module = load('../components/wallet/SwapReceipt.tsx', { ...dependencies,
        './SwapSheet': { CoinLogo: 'CoinLogo' }, './swap-model': model,
      });
      tree = h.render(() => module.SwapReceipt({ receipt: { reference: 'fixture', createdAt: 'fixture date',
        pay: model.SWAP_COINS[0], receive: model.SWAP_COINS[1], quote: { amount: 2, receiveAmount: 2, feeAmount: 0 } }, onClose() {} }));
      prefix = 'wallet-swap';
    }
    const capture = byId(tree, `${prefix}-receipt-image`);
    assert.equal(capture.props.ref, receiptRef);
    assert.equal(capture.props.collapsable, false);
    assert.ok(byId(capture, `${prefix}-receipt-summary`));
    assert.ok(byId(capture, `${prefix}-receipt-details`));
    const button = byId(tree, type === 'send' ? 'wallet-send-receipt-share' : 'wallet-receipt-share');
    assert.equal(nodes(capture).includes(button), false);
    await button.props.onPress(); assert.equal(calls, 1);
  });
}
