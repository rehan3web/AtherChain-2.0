// All account APIs are intercepted; this never sends email or resets a real account.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const target = targets.find(item => item.type === 'page');
assert.ok(target, 'Start an isolated Chromium with remote debugging on port 9222');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map(), calls = [], unexpected = [];
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
ws.addEventListener('message', async ({ data }) => {
  const event = JSON.parse(data);
  if (event.id) {
    const call = pending.get(event.id); if (!call) return; pending.delete(event.id);
    if (event.error) call.reject(Error(JSON.stringify(event.error))); else call.resolve(event.result);
  } else if (event.method === 'Fetch.requestPaused') {
    const { requestId, request } = event.params;
    const route = new URL(request.url).pathname.replace(/^\/api/, '');
    const body = request.postData ? JSON.parse(request.postData) : {};
    calls.push({ route, body });
    let responseCode = 200, response = { message: 'Fixture confirmed' };
    if (route === '/auth/login')
      response = { require2FA: true, userId: 'recovery-fixture' };
    else if (route === '/auth/start-2fa-recovery')
      response = { message: 'Code sent', userId: 'recovery-fixture', maskedEmail: 'o***r@test.example' };
    else if (route === '/auth/verify-reset-otp' || route === '/auth/verify-2fa-recovery') {
      if ((body.token ?? body.otp) !== '123456') {
        responseCode = 400; response = { message: 'Fixture invalid or expired verification code' };
      }
    } else if (!['/auth/forgot-password', '/auth/reset-password'].includes(route)) {
      unexpected.push(route); responseCode = 404; response = { message: 'Unexpected fixture API' };
    }
    await sleep(700);
    await send('Fetch.fulfillRequest', { requestId, responseCode,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
      body: Buffer.from(JSON.stringify(response)).toString('base64') });
  }
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const q = id => `document.querySelector('[data-testid="${id}"]')`;
async function until(expression) {
  for (let attempt = 0; attempt < 240; attempt++) {
    if (await evaluate(expression)) return;
    await sleep(100);
  }
  throw Error(`Timed out: ${expression}\n${await evaluate('document.body.innerText')}`);
}
const wait = id => until(`!!${q(id)}`);
const click = async id => { await wait(id); await evaluate(`${q(id)}.click()`); await sleep(40); };
async function fill(id, value) {
  await wait(id);
  await evaluate(`(() => {const el=${q(id)};
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});
    el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await sleep(150);
}
const digits = async code => { for (const digit of code) await click(`recovery-key-${digit}`); };
const capture = async name => {
  const result = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
  await fs.writeFile(`generated-artifacts/password-recovery/${name}.jpg`, Buffer.from(result.data, 'base64'));
};
async function openPasswordStep() {
  await wait('login-identifier');
  assert.equal(await evaluate(`!!${q('login-forgot-password')} || !!${q('login-reset-twofa')}`), false);
  await fill('login-identifier', 'owner@test.example'); await click('login-next');
  await wait('login-forgot-password');
}
async function checkRecoveryLink(id) {
  assert.equal(await evaluate(`(() => {
    const field=${q('login-password')}.parentElement.getBoundingClientRect();
    const link=${q(id)}.getBoundingClientRect();
    return link.top >= field.bottom && Math.abs(link.right-field.right)<2;
  })()`), true, 'Recovery link should sit under the input, aligned right');
}
const base = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://127.0.0.1:5000';
try {
  await fs.mkdir('generated-artifacts/password-recovery', { recursive: true });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 402, height: 874, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: `${base}/login` });
  await openPasswordStep();
  await checkRecoveryLink('login-forgot-password');
  await capture('password-link-placement');
  await click('login-forgot-password'); await fill('recovery-email', 'owner@test.example');
  await click('recovery-next');
  await wait('recovery-next-loading');
  await wait('recovery-keypad'); await capture('password-otp');
  assert.equal(await evaluate(`${q('recovery-otp-screen')}.querySelector('input') === null`), true);
  await digits('111111');
  await until(`${q('twofa-anim-status')}?.textContent === 'error'`);
  assert.equal(await evaluate(`${q('recovery-password')} !== null`), false);
  await until(`${q('twofa-anim-status')}?.textContent === 'entry'`);
  await digits('123456');
  await wait('twofa-success-circle');
  await until(`Number(${q('twofa-success-circle')}?.querySelector('path')?.getAttribute('stroke-dashoffset')) === 0`);
  await capture('password-otp-tick-animation');
  await wait('recovery-password');
  await fill('recovery-password', 'fixture-new-password');
  await fill('recovery-confirm-password', 'fixture-new-password');
  await capture('password-new-password');
  await click('recovery-next');
  await wait('login-screen');
  await until(`document.body.innerText.includes('Password reset')`);
  assert.equal(await evaluate(`${q('login-identifier')}.value`), '');
  assert.ok(calls.some(call => call.route === '/auth/reset-password' && call.body.token === '123456'));
  console.log('Password recovery: email, loading, rejected OTP, animated success, new password, toast and Login verified');

  await openPasswordStep();
  await fill('login-password', 'fixture-password'); await click('login-submit');
  await wait('login-reset-twofa');
  assert.equal(await evaluate(`!!${q('login-forgot-password')}`), false);
  await checkRecoveryLink('login-reset-twofa');
  await capture('twofa-link-placement');
  await click('login-reset-twofa'); await fill('recovery-email', 'owner@test.example'); await click('recovery-next');
  await wait('recovery-keypad');
  await digits('123456'); await wait('twofa-success-circle');
  await until(`Number(${q('twofa-success-circle')}?.querySelector('path')?.getAttribute('stroke-dashoffset')) === 0`);
  await capture('twofa-otp-tick-animation');
  await wait('login-screen'); await until(`document.body.innerText.includes('2FA reset')`);
  assert.ok(calls.some(call => call.route === '/auth/verify-2fa-recovery'
    && call.body.userId === 'recovery-fixture' && call.body.otp === '123456'));
  assert.equal(calls.filter(call => call.route === '/auth/reset-password').length, 1);
  assert.equal(await evaluate(`localStorage.getItem('ather_token')`), null);
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 1, mobile: true });
  await openPasswordStep();
  await click('login-forgot-password'); await fill('recovery-email', 'owner@test.example'); await click('recovery-next');
  await wait('recovery-keypad');
  await evaluate(`${q('recovery-key-0')}.scrollIntoView({block:'center'})`);
  assert.equal(await evaluate(`(() => { const r=${q('recovery-key-0')}.getBoundingClientRect();
    return r.top>=0 && r.bottom<=568 && r.left>=0 && r.right<=320; })()`), true);
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= 320`), true);
  await capture('small-phone-keypad');
  await click('recovery-otp-back'); await wait('recovery-email');
  await click('recovery-back'); await wait('login-screen');
  assert.deepEqual(unexpected, []);
  console.log('2FA recovery: dedicated email OTP reset, same animated tick and return to Login; no authenticated session created');
  console.log('Small phone: keypad remains reachable without horizontal overflow; back navigation verified');
} finally { ws.close(); }
