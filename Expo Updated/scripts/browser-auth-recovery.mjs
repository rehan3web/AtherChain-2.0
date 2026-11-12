// Real UI against intercepted, isolated API fixtures. Never calls account APIs.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const target = targets.find(item => item.type === 'page');
assert.ok(target, 'Start an isolated Chromium with remote debugging on port 9222');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0, mode = 'error', logins = 0;
const pending = new Map(), mutations = [];
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
ws.addEventListener('message', ({ data }) => {
  const event = JSON.parse(data);
  if (event.id) {
    const call = pending.get(event.id); if (!call) return; pending.delete(event.id);
    if (event.error) call.reject(new Error(JSON.stringify(event.error))); else call.resolve(event.result);
  } else if (event.method === 'Fetch.requestPaused') {
    const { requestId, request } = event.params;
    const path = new URL(request.url).pathname.replace(/^\/api/, '');
    let status = 200, result = {};
    if (request.method !== 'GET' && request.method !== 'OPTIONS') mutations.push([request.method, path]);
    if (path === '/auth/login') {
      logins++;
      if (mode === 'error') { status = 400; result = { message: 'Fixture invalid credentials' }; }
      else if (logins === 1) {
        status = 403; result = { code: 'SESSION_LIMIT_EXCEEDED', sessionManagementToken: 'fixture-limited',
          sessions: [{ id: 'one', device: 'Fixture Phone' }, { id: 'two', device: 'Fixture Browser' }] };
      } else result = { require2FA: true, userId: 'fixture-owner', message: 'Enter the authenticator code.' };
    }
    // All API calls, including unexpected ones, are fulfilled here, never continued.
    setTimeout(() => { void send('Fetch.fulfillRequest', { requestId, responseCode: status,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' },
        { name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: '*' }],
      body: Buffer.from(JSON.stringify(result)).toString('base64') }); }, path === '/auth/login' ? 1200 : 400);
  }
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
const q = id => `document.querySelector('[data-testid="${id}"]')`;
async function wait(expression) {
  const until = Date.now() + 45000;
  while (Date.now() < until) { if (await evaluate(`!!(${expression})`)) return; await sleep(100); }
  throw new Error(`Timed out: ${expression}`);
}
const click = async id => { await wait(q(id)); await evaluate(`${q(id)}.click()`); await sleep(100); };
const fill = async (id, value) => {
  await wait(q(id));
  await evaluate(`(() => { const el=${q(id)}; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await sleep(100);
};
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
async function navigate(path) {
  await send('Page.navigate', { url: base + path });
  await wait('document.readyState === "complete"');
}
try {
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 402, height: 874, deviceScaleFactor: 1, mobile: false });
  await fs.mkdir('generated-artifacts/auth-checks', { recursive: true });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*', requestStage: 'Request' }] });
  await navigate('/signup'); await wait(q('signup-identifier'));
  assert.equal(await evaluate(`${q('signup-identifier')}.getAttribute('aria-label')`), 'Email');
  await fill('signup-identifier', 'username_only'); await click('signup-next');
  await wait(`document.querySelector('[data-testid^="toast-error-"]')`);
  assert.equal(await evaluate(`!!${q('signup-email')}`), false);
  await fill('signup-identifier', 'fixture@example.test'); await click('signup-next');
  await wait(q('signup-username'));
  console.log('PASS: Email then Username, no duplicate email, validation uses a red toast.');

  await navigate('/login'); await wait(q('login-identifier'));
  await fill('login-identifier', 'fixture@example.test'); await click('login-next');
  await fill('login-password', 'fixture-password'); await click('login-submit');
  await wait(q('login-submit-loading'));
  assert.equal(await evaluate('document.body.innerText.includes("Opening…")'), false);
  await wait(`document.querySelector('[data-testid^="toast-error-"]')`);
  await wait(`${q('login-submit-loading')} === null`);
  assert.ok((await evaluate(`${q('login-submit')}.innerText`)).includes('Login'));
  await sleep(250);
  const errorImage = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile('generated-artifacts/auth-checks/login-error.png', Buffer.from(errorImage.data, 'base64'));
  console.log('PASS: delayed login shows a spinner; failure shows toast without a Retry label.');

  mode = 'limit'; logins = 0;
  await click('login-submit'); await wait(q('login-session-limit'));
  await sleep(500);
  const sheetImage = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile('generated-artifacts/auth-checks/session-limit.png', Buffer.from(sheetImage.data, 'base64'));
  await click('login-remove-session-one'); await wait(q('login-remove-session-one-loading'));
  await wait(`${q('login-password')}?.getAttribute('aria-label') === 'Verification code'`);
  assert.equal(logins, 2);
  assert.equal(mutations.filter(([method]) => method === 'DELETE').length, 1);
  assert.equal(await evaluate('localStorage.getItem("ather_token")'), null);
  console.log('PASS: selected-session removal automatically resumes login, preserving 2FA.');
  await fs.mkdir('generated-artifacts/auth-checks', { recursive: true });
  await sleep(250);
  const image = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile('generated-artifacts/auth-checks/session-recovered.png', Buffer.from(image.data, 'base64'));
} finally { ws.close(); }
