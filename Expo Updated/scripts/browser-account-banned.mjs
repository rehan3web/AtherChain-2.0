// Uses actual dummy login controls. Never injects authentication/session state.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.APP_URL ?? 'http://127.0.0.1:18115';
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data), callback = pending.get(message.id);
  if (!callback) return;
  pending.delete(message.id);
  message.error ? callback.reject(Error(JSON.stringify(message.error))) : callback.resolve(message.result);
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
const wait = async name => {
  for (let n = 0; n < 200; n++) {
    if (await evaluate(`!!${query(name)}`)) return;
    await sleep(250);
  }
  throw Error(`Missing ${name}: ${await evaluate('document.body.innerText')}`);
};
const click = async name => { await wait(name); await evaluate(`${query(name)}.click()`); await sleep(250); };
const fill = async (name, value) => {
  await wait(name);
  await evaluate(`(() => {
    const el=${query(name)};el.focus();
    const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});
    el.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await sleep(100);
};
let previousTheme = null, backedUp = false;
try {
  await send('Emulation.setDeviceMetricsOverride', { width: 393, height: 851, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}/login` });
  await wait('login-identifier');
  previousTheme = await evaluate(`localStorage.getItem('atherchain-theme-v1')`); backedUp = true;
  await fill('login-identifier', ' BAN@Test.com ');
  await click('login-next');
  await fill('login-password', 'made-up-123');
  await click('login-submit');
  await wait('account-banned-screen');
  assert.equal(await evaluate(`${query('account-banned-status')}.innerText`), 'Banned');
  assert.equal(await evaluate(`${query('account-banned-reason')}.innerText`), 'Abuse of App');
  assert.equal(await evaluate(`!!${query('screen-dashboard')}`), false);
  assert.equal(await evaluate(`!!${query('notification-permission-screen')}`), false);
  console.log('PASS: actual banned password login shows the requested reason without entering the wallet');
  for (const theme of ['light', 'dark']) {
    await evaluate(`localStorage.setItem('atherchain-theme-v1',${JSON.stringify(theme)})`);
    await send('Page.reload');
    await wait('account-banned-screen');
    await sleep(350);
    for (const [width, height] of [[320, 568], [393, 851], [430, 932], [768, 1024], [844, 390]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await sleep(150);
      const bounds = await evaluate(`(() => {
        const page=${query('account-banned-screen')};
        const login=${query('account-banned-login')}.getBoundingClientRect();
        const help=${query('account-banned-help')}.getBoundingClientRect();
        return {overflow:page.scrollWidth-page.clientWidth,left:login.left,loginRight:login.right,helpLeft:help.left,right:help.right,bottom:help.bottom,height:help.height};
      })()`);
      assert.ok(bounds.overflow <= 1);
      assert.ok(bounds.left >= 0 && bounds.right <= width + 1);
      assert.ok(bounds.loginRight < bounds.helpLeft, 'Login left, Help right');
      assert.ok(bounds.bottom <= height && bounds.height >= 44);
    }
    await send('Emulation.setDeviceMetricsOverride', { width: 393, height: 851, deviceScaleFactor: 1, mobile: false });
    await sleep(250);
    await fs.mkdir('generated-artifacts', { recursive: true });
    const image = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    await fs.writeFile(`generated-artifacts/account-banned-${theme}.jpg`, Buffer.from(image.data, 'base64'));
  }
  console.log('PASS: both themes fit five screen sizes with Login left and Help right');
  await click('account-banned-help');
  await wait('screen-help');
  await click('help-create');
  await wait('help-subject');
  await fill('help-subject', 'Dummy banned account review');
  await fill('help-description', 'Practice request to review the account status.');
  await click('help-submit');
  await wait('ticket-chat-screen');
  await click('ticket-chat-back');
  await wait('screen-help');
  await click('help-back');
  await wait('account-banned-screen');
  console.log('PASS: Help and ticket creation work before login; Back returns to the banned screen');
  await click('account-banned-login');
  await wait('login-identifier');
  assert.equal(await evaluate(`${query('login-identifier')}.value`), '');
  await fill('login-identifier', 'ban@test.com');
  await click('login-passkey');
  await click('login-passkey-confirm');
  await wait('account-banned-screen');
  console.log('PASS: Login returns to a cleared form and practice passkey cannot bypass the banned outcome');
  await click('account-banned-login');
  await fill('login-identifier', 'regular_practice');
  await click('login-next');
  await fill('login-password', 'made-up-123');
  await click('login-submit');
  await wait('screen-dashboard');
  console.log('PASS: other dummy logins still reach the dashboard');
} finally {
  if (backedUp) await evaluate(previousTheme === null
    ? `localStorage.removeItem('atherchain-theme-v1')`
    : `localStorage.setItem('atherchain-theme-v1',${JSON.stringify(previousTheme)})`);
  ws.close();
}
