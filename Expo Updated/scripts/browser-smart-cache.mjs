// Browser fixture only: intercept every API request; never contact the live backend.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0, version = 1;
const pending = new Map(), counts = {}, unexpected = [], errors = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
ws.addEventListener('message', async ({ data }) => {
  const message = JSON.parse(data), callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    if (message.error) callback.reject(Error(JSON.stringify(message.error))); else callback.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = message.params, route = new URL(request.url).pathname.replace(/^\/api/, '');
  counts[route] = (counts[route] ?? 0) + 1;
  let body, status = 200;
  if (request.method !== 'GET') {
    unexpected.push(`${request.method} ${route}`); status = 405; body = { message: 'No mutations allowed' };
  } else if (route === '/user/me') body = {
    id: 'cache-fixture', first_name: 'Fixture', last_name: version === 1 ? 'One' : 'Two',
    username: 'cache_fixture', at_balance: String(version * 100), mining_sessions_count: 1,
    last_mined_at: new Date(Date.now() - 3600_000).toISOString(), twofa_enabled: true,
  };
  else if (route === '/mining/status') body = {
    canMine: false, timeLeft: 3600, currentYield: 2, dailyReward: 2, currentCycleBoosts: 0, maxBoosts: 3, boostEnabled: true,
  };
  else if (route === '/user/statistics') body = { miningCalendar: [] };
  else if (route === '/transactions') body = {
    data: version === 1 ? [] : [{ id: 'cache-send', type: 'send', amount: '1', status: 'completed',
      timestamp: '2026-11-13T12:00:00Z', txHash: 'cache-fixture-reference', toAddress: `ATH_${'a'.repeat(40)}` }],
    meta: { totalPages: 1 },
  };
  else if (route === '/user/kyc/status') {
    await sleep(700);
    body = { status: ['pending', 'approved', 'rejected'][counts[route] - 1] ?? 'rejected', id_type: 'passport' };
  }
  else if (route === '/user/kyc/config') body = {};
  else { unexpected.push(`GET ${route}`); status = 404; body = { message: 'Unknown fixture endpoint' }; }
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
async function wait(id, text) {
  for (let attempt = 0; attempt < 240; attempt++) {
    if (await evaluate(`!!${query(id)} && ${text ? `${query(id)}.innerText.includes(${JSON.stringify(text)})` : 'true'}`)) return;
    await sleep(200);
  }
  throw Error(`Missing ${id}: ${await evaluate('document.body.innerText')}`);
}
async function click(id) {
  await wait(id);
  if (id.startsWith('dock-')) {
    // The existing dock uses a PanResponder, rather than a DOM click handler.
    const point = await evaluate(`(() => { const r = ${query(id)}.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; })()`);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else await evaluate(`${query(id)}.click()`);
}
async function capture(name) {
  const image = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(`generated-artifacts/cache-browser/${name}.png`, Buffer.from(image.data, 'base64'));
}
await send('Page.enable'); await send('Runtime.enable');
await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*' }] });
await send('Emulation.setDeviceMetricsOverride', { width: 402, height: 874, deviceScaleFactor: 1, mobile: true });
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try { localStorage.setItem('ather_token', 'cache-fixture-only'); } catch {}`,
});
try {
  await fs.mkdir('generated-artifacts/cache-browser', { recursive: true });
  await send('Page.navigate', { url: 'http://127.0.0.1:5000/' });
  await wait('dashboard-total-balance', '100');
  assert.equal(counts['/user/me'], 1, 'Startup validation and dashboard/profile should reuse the same fresh profile');
  const initial = { ...counts };
  await click('dashboard-statistics'); await wait('statistics-total-transfer', '0'); await sleep(250);
  assert.deepEqual(counts, initial, 'Opening statistics should reuse fresh dashboard/history data');
  console.log('Dashboard → statistics: no additional HTTP requests');
  version = 2;
  await click('statistics-refresh-button'); await wait('statistics-total-transfer', '1');
  assert.equal(counts['/mining/status'], 2);
  assert.equal(counts['/user/statistics'], 2);
  assert.equal(counts['/transactions'], 2);
  assert.equal(counts['/user/me'], 2);
  console.log('Explicit statistics refresh: refreshed totals and receipts once per endpoint');
  const refreshed = { ...counts };
  await click('statistics-back');
  await wait('dashboard-total-balance', '200');
  await wait('screen-dashboard', 'Fixture Two');
  assert.deepEqual(counts, refreshed, 'Returning to dashboard should use refreshed shared data');
  await capture('dashboard');
  await click('dock-settings'); await wait('settings-profile-name', 'Fixture Two');
  assert.equal(counts['/user/me'], 2, 'Settings should reuse the long-lived profile cache');
  await click('settings-row-kyc'); await wait('kyc-loading'); await wait('kyc-screen', 'Verification Pending');
  assert.equal(await evaluate(`!!${query('kyc-start')}`), false);
  await capture('kyc-pending');
  await sleep(31_000);
  assert.equal(counts['/user/kyc/status'], 1, 'KYC must not poll at 15 or 30 seconds');
  console.log('KYC stayed open for 31 seconds: exactly one status request, no polling');
  await click('kyc-done'); await wait('settings-row-kyc'); await click('settings-row-kyc');
  await wait('kyc-loading'); await wait('kyc-screen', 'Verification Approved');
  assert.equal(counts['/user/kyc/status'], 2);
  await click('kyc-done'); await wait('settings-row-kyc'); await click('settings-row-kyc');
  await wait('kyc-loading'); await wait('kyc-resubmit');
  assert.equal(counts['/user/kyc/status'], 3);
  console.log('Reopening KYC: fetched and showed approved/rejected statuses correctly');
  assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
} finally { ws.close(); }
