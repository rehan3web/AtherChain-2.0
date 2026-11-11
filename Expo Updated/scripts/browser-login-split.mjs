// Start Chromium with --remote-debugging-port=9222, then run with APP_URL set.
// Only uses real form controls; never injects account/session state.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', ({ data }) => {
  const msg = JSON.parse(data), p = pending.get(msg.id);
  if (!p) return;
  pending.delete(msg.id);
  if (msg.error) p.reject(Error(JSON.stringify(msg.error))); else p.resolve(msg.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const key = ++id; pending.set(key, { resolve, reject }); ws.send(JSON.stringify({ id: key, method, params }));
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const query = name => `document.querySelector('[data-testid="${name}"]')`;
const exists = name => evaluate(`!!${query(name)}`);
const wait = async name => {
  for (let n = 0; n < 100; n++) { if (await exists(name)) return; await sleep(400); }
  throw Error(`Missing ${name}: ${await evaluate('document.body.innerText')}`);
};
const click = async name => {
  await wait(name);
  // Dock navigation intentionally uses pointer handlers rather than click.
  // Ordinary RN Pressables support click even while a sheet is animating.
  if (!name.startsWith('dock-')) {
    await evaluate(`${query(name)}.click()`);
    await sleep(500);
    return;
  }
  const { x, y } = await evaluate(`(() => {
    const el=${query(name)}; el.scrollIntoView({block:'center'});
    const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};
  })()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await sleep(180);
};
const fill = async (name, value) => {
  await wait(name);
  await evaluate(`(() => {
    const el=${query(name)}; el.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});
    el.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await sleep(100);
};
const capture = async name => {
  await sleep(400);
  await fs.mkdir('generated-artifacts', { recursive: true });
  const result = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
  await fs.writeFile(`generated-artifacts/${name}.jpg`, Buffer.from(result.data, 'base64'));
};
const base = process.env.APP_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN}`;
try {
  await send('Emulation.setDeviceMetricsOverride', { width: 402, height: 874, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}/login` });
  for (let n = 0; n < 100; n++) {
    if (await exists('login-identifier') || await exists('screen-dashboard')) break;
    await sleep(400);
  }
  if (await exists('screen-dashboard')) {
    await click('dock-settings');
    await click('settings-row-logout'); await click('settings-logout-confirm');
    await click('welcome-login');
  }
  await wait('login-identifier');
  assert.equal(await exists('login-password'), false);
  await click('login-next');
  assert.equal(await exists('login-identifier'), true);
  await fill('login-identifier', 'practice_user');
  await capture('login-identifier');
  await click('login-next');
  await wait('login-password');
  assert.equal(await exists('login-identifier'), false);
  await click('login-submit');
  assert.equal(await exists('login-password'), true);
  await fill('login-password', 'made-up-123');
  await capture('login-password');
  await click('login-back');
  assert.equal(await evaluate(`${query('login-identifier')}.value`), 'practice_user');
  await click('login-passkey');
  await wait('login-passkey-confirm');
  await click('login-passkey-cancel');
  assert.equal(await exists('login-identifier'), true);
  await click('login-next');
  assert.equal(await evaluate(`${query('login-password')}.value`), '');
  await fill('login-password', 'made-up-123'); await click('login-submit');
  await wait('screen-dashboard');
  assert.equal(await exists('header-theme-switch'), false);
  assert.equal(await exists('dashboard-scan'), true);
  assert.equal(await exists('dashboard-notifications'), true);
  await capture('dashboard-no-theme-switch');
  await click('dock-settings');
  await click('settings-row-logout'); await click('settings-logout-confirm');
  await wait('welcome-login'); await click('welcome-login');
  await fill('login-identifier', 'practice@example.com');
  await click('login-passkey'); await click('login-passkey-confirm');
  await wait('screen-dashboard');
  console.log('PASS: split password login, validation, back, passkey cancel/confirm and header removal.');
} finally { ws.close(); }
