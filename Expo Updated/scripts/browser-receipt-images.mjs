// Hermetic browser verification: every API request is fulfilled locally.
// No live account is used and no request reaches the real backend.
// Start Chromium with --remote-debugging-port=9222 before running.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map(), unexpected = [], errors = [];
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
const tx = (id, type, amount, metadata = {}) => ({ id, type, amount, metadata,
  timestamp: '2026-11-13T12:00:00Z', txHash: `fixture-${id}`, status: 'completed',
  fromAddress: `ATH_${'a'.repeat(40)}`, toAddress: `ATH_${'b'.repeat(40)}` });
const history = [
  tx('fixture-send', 'send', '2.50', { recipient: { method: 'username', value: '@fixture_friend' } }),
  tx('fixture-swap', 'swap', '3', { fromAmount: 3, toAmount: 3, rate: 1 }),
];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
ws.addEventListener('message', async ({ data }) => {
  const message = JSON.parse(data), callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    if (message.error) callback.reject(Error(JSON.stringify(message.error)));
    else callback.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = message.params;
  const path = new URL(request.url).pathname.replace(/^\/api/, '');
  let body, status = 200;
  if (request.method !== 'GET') {
    unexpected.push(`${request.method} ${path}`);
    body = { message: 'Mutations are disabled in this fixture' }; status = 405;
  } else if (path === '/user/me') {
    await sleep(700);
    body = { id: 'fixture-user', username: 'fixture_user', first_name: 'Fixture', last_name: 'User',
      twofa_enabled: true, at_balance: '100', kyc_status: 'approved' };
  } else if (path === '/transactions') body = { data: history, meta: { totalPages: 1, currentPage: 1 } };
  else if (path === '/auth/sessions') {
    await sleep(700);
    body = { sessions: [{ id: 'fixture-session', device: 'Fixture browser', loginTime: '2026-11-13T12:00:00Z', isCurrent: true }] };
  } else if (path === '/notifications') {
    await sleep(700); body = [];
  } else { unexpected.push(`GET ${path}`); status = 404; body = { message: 'Unconfigured fixture' }; }
  await send('Fetch.fulfillRequest', { requestId, responseCode: status,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
    body: Buffer.from(JSON.stringify(body)).toString('base64') });
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const query = id => `document.querySelector('[data-testid="${id}"]')`;
async function wait(id) {
  for (let attempt = 0; attempt < 240; attempt++) {
    if (await evaluate(`!!${query(id)}`)) return;
    await sleep(250);
  }
  throw Error(`Missing ${id}: ${await evaluate('document.body.innerText')}`);
}
async function click(id) { await wait(id); await evaluate(`${query(id)}.click()`); }
await send('Page.enable');
await send('Runtime.enable');
await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*' }] });
await send('Emulation.setDeviceMetricsOverride', { width: 402, height: 874, deviceScaleFactor: 1, mobile: true });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  try { localStorage.setItem('ather_token', 'fixture-only-token'); } catch {}
  window.__sharedReceipt = null;
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
  Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
    if (Object.keys(data).join(',') !== 'files') throw Error('Receipt sharing must contain only an image file');
    const file = data.files[0];
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
    });
    window.__sharedReceipt = { name: file.name, type: file.type, dataUrl };
  } });
` });
async function navigate(path) {
  await send('Page.navigate', { url: `http://127.0.0.1:5000${path}` });
}
async function verifyImage(type) {
  await click(`txn-history-row-fixture-${type}`);
  const prefix = type === 'send' ? 'wallet-send' : 'wallet-swap';
  await wait(`${prefix}-receipt-image`);
  await sleep(500); // Let the receipt modal finish its entrance animation.
  await evaluate('document.fonts.ready');
  if (process.argv.includes('--debug-fonts')) console.log(type, await evaluate(`({
    used: [...new Set([...${query(`${prefix}-receipt-image`)}.querySelectorAll('*')].map(node => getComputedStyle(node).fontFamily))],
    declared: [...document.styleSheets].flatMap(sheet => [...sheet.cssRules].filter(rule => rule.type === CSSRule.FONT_FACE_RULE).map(rule => rule.style.fontFamily))
  })`));
  await evaluate(`Promise.all([...${query(`${prefix}-receipt-image`)}.querySelectorAll('img')].map(image =>
    image.complete ? Promise.resolve() : new Promise(resolve => { image.onload = resolve; image.onerror = resolve; })))`);
  const size = await evaluate(`(() => { const r = ${query(`${prefix}-receipt-image`)}.getBoundingClientRect(); return { width: r.width, height: r.height }; })()`);
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(`generated-artifacts/receipt-browser/${type}-screen.png`, Buffer.from(screenshot.data, 'base64'));
  await evaluate('window.__sharedReceipt = null');
  await click(type === 'send' ? 'wallet-send-receipt-share' : 'wallet-receipt-share');
  let image;
  for (let attempt = 0; attempt < 160; attempt++) {
    image = await evaluate('window.__sharedReceipt');
    if (image) break;
    await sleep(250);
  }
  assert.ok(image, `No ${type} receipt image: ${await evaluate('document.body.innerText')}`);
  assert.equal(image.type, 'image/png');
  const png = Buffer.from(image.dataUrl.split(',')[1], 'base64');
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), Math.round(size.width * 2));
  assert.equal(png.readUInt32BE(20), Math.round(size.height * 2));
  const visibleHeight = await evaluate(`${query(`${prefix}-receipt-body`)}.getBoundingClientRect().height`);
  assert.ok(size.height > visibleHeight, `Expected the full scrollable ${type} receipt, got ${size.height} within ${visibleHeight}`);
  await fs.writeFile(`generated-artifacts/receipt-browser/${type}.png`, png);
  console.log(`${type}: verified full PNG ${png.readUInt32BE(16)}×${png.readUInt32BE(20)}, ${png.length} bytes`);
  await click(type === 'send' ? 'wallet-send-receipt-close' : 'wallet-receipt-close');
}
try {
  await fs.mkdir('generated-artifacts/receipt-browser', { recursive: true });
  await navigate('/transactions');
  await wait('txn-history-row-fixture-send');
  await verifyImage('send');
  await verifyImage('swap');
  for (const [path, loading, ready, forbidden] of [
    ['/twofa', 'twofa-loading', 'twofa-disable', 'twofa-enable'],
    ['/sessions', 'sessions-loading', 'sessions-sign-out-fixture-session', 'sessions-empty'],
    ['/notifications', 'notifications-loading', 'notifications-empty', null],
  ]) {
    await navigate(path);
    await wait(loading);
    if (forbidden) assert.equal(await evaluate(`!!${query(forbidden)}`), false);
    await wait(ready);
    console.log(`${path}: verified fetch-first loading`);
  }
  assert.deepEqual(unexpected, []);
  assert.deepEqual(errors, []);
} finally {
  ws.close();
}
