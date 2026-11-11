// Runs against a Chromium instance started with --remote-debugging-port=9222.
// Exercises the real signup UI; never skips the entry gate or injects application state.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const target = targets.find(t => t.type === 'page');
assert.ok(target, 'Start headless Chromium with remote debugging on port 9222');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map();
ws.addEventListener('message', ({ data }) => {
  const msg = JSON.parse(data);
  if (!msg.id) return;
  const handlers = pending.get(msg.id);
  pending.delete(msg.id);
  if (msg.error) handlers.reject(Error(JSON.stringify(msg.error))); else handlers.resolve(msg.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const selector = id => `[data-testid="${id}"]`;
const width = Number(process.env.WIDTH ?? 402);
const height = Number(process.env.HEIGHT ?? 874);
const baseURL = process.env.APP_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN}`;
const wait = async id => {
  for (let n = 0; n < 120; n++) {
    if (await evaluate(`!!document.querySelector(${JSON.stringify(selector(id))})`)) return;
    await sleep(500);
  }
  throw Error(`Missing ${id}: ${await evaluate('document.body.innerText')}`);
};
const click = async id => {
  await wait(id);
  await evaluate(`document.querySelector(${JSON.stringify(selector(id))}).click()`);
  await sleep(120);
};
const fill = async (id, text) => {
  await wait(id);
  await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector(id))});
    el.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(text)});
    el.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await sleep(80);
};
const capture = async name => {
  await fs.mkdir('generated-artifacts', { recursive: true });
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
  await fs.writeFile(`generated-artifacts/${name}.jpg`, Buffer.from(shot.data, 'base64'));
};
try {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${baseURL}/` });
  for (let n = 0; n < 120; n++) {
    if (await evaluate(`!!document.querySelector('[data-testid="welcome-screen"],[data-testid="screen-dashboard"]')`)) break;
    await sleep(500);
  }
  if (await evaluate(`!!document.querySelector('[data-testid="screen-dashboard"]')`)) {
    await send('Page.navigate', { url: `${baseURL}/settings` });
    await click('settings-row-logout'); await click('settings-logout-confirm');
  }
  await click('welcome-signup');
  await wait('signup-identifier');
  await fill('signup-identifier', 'practice@example.com'); await click('signup-next');
  await fill('signup-username', 'practice_user'); await click('signup-next');
  await fill('signup-password', 'made-up-123'); await fill('signup-confirm', 'made-up-123'); await click('signup-next');
  await fill('signup-first-name', 'Practice'); await fill('signup-last-name', 'User'); await click('signup-next');
  await click('signup-country'); await fill('kyc-country-search', 'United States'); await click('kyc-country-US'); await click('signup-next');
  await click('signup-skip');
  await fill('signup-phone', '2025550123'); await click('signup-next');
  await wait('signup-keypad'); await sleep(500);
  await evaluate(`document.querySelector('[data-testid="signup-keypad"]').scrollIntoView({block:'end'})`);
  await capture(`signup-otp-${width}x${height}`);
  const geometry = await evaluate(`(() => {
    const keys=[...document.querySelectorAll('[data-testid^="signup-key-"]')];
    return keys.map(el=>{ const r=el.getBoundingClientRect();return {id:el.dataset.testid,x:r.x,y:r.y,width:r.width,height:r.height};});
  })()`);
  console.log('Signup OTP key geometry:', geometry);
  assert.equal(geometry.length, 11);
  assert.ok(geometry.every(k => k.width > 70 && k.height >= 48 && k.y >= 0 && k.y + k.height <= height), 'All keypad keys must be fully visible');
  assert.equal(new Set(geometry.map(k => Math.round(k.y))).size, 4, 'Wallet keypad must have four rows');
  assert.equal(await evaluate(`document.querySelector('[data-testid="signup-step-otp"] input') !== null`), false);
  const keyStyle = async prefix => evaluate(`(() => {
    const el=document.querySelector('[data-testid="${prefix}-1"]'), s=getComputedStyle(el), t=getComputedStyle(el.firstElementChild);
    return {height:s.height,background:s.backgroundColor,radius:s.borderRadius,fontSize:t.fontSize};
  })()`);
  const signupStyle = await keyStyle('signup-key');
  for (const digit of '123456') await click(`signup-key-${digit}`);
  await sleep(1200);
  assert.match(await evaluate(`document.querySelector('[data-testid="twofa-circles"]').getAttribute('aria-label')`), /0 of 6/);
  for (const digit of '654321') await click(`signup-key-${digit}`);
  await wait('screen-dashboard');
  await send('Page.navigate', { url: `${baseURL}/twofa` });
  await click('twofa-enable'); await click('twofa-next');
  assert.deepEqual(await keyStyle('twofa-key'), signupStyle, 'Signup must render the exact same key styles as 2FA');
  await capture(`twofa-otp-${width}x${height}`);
  console.log('PASS: visible 4-row wallet keypad, rejection/reset, signup success and exact style match with 2FA.');
} finally {
  ws.close();
}
