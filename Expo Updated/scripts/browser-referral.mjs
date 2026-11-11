import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.APP_URL ?? 'http://127.0.0.1:18115';
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map();
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data), callback = pending.get(message.id);
  if (!callback) return;
  pending.delete(message.id);
  message.error ? callback.reject(Error(JSON.stringify(message.error))) : callback.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const query = id => `Array.from(document.querySelectorAll('[data-testid="${id}"]')).find(el=>el.getClientRects().length&&!el.closest('[aria-hidden="true"]'))`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const exists = id => evaluate(`!!${query(id)}`);
const wait = async id => {
  for (let n = 0; n < 160; n++) { if (await exists(id)) return; await sleep(200); }
  throw Error(`Missing ${id}`);
};
const click = async id => { await wait(id); await evaluate(`${query(id)}.click()`); await sleep(200); };
const fill = async (id, value) => {
  await wait(id);
  await evaluate(`(() => {const el=${query(id)};el.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
};

try {
  await send('Emulation.setDeviceMetricsOverride', { width: 393, height: 851, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}/referral` });
  for (let n = 0; n < 160; n++) {
    if (await exists('referral-copy-code') || await exists('welcome-login')) break;
    await sleep(200);
  }
  if (await exists('welcome-login')) {
    // Enter through the normal dummy login UI; never inject an auth session.
    await click('welcome-login');
    await fill('login-identifier', 'practice_user');
    await click('login-next');
    await fill('login-password', 'made-up-123');
    await click('login-submit');
    await wait('screen-dashboard');
    await send('Page.navigate', { url: `${base}/referral` });
  }
  await wait('referral-copy-code');
  await send('Browser.grantPermissions', { origin: base, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
  await evaluate(`${query('referral-copy-code')}.scrollIntoView({block:'center'})`);
  await sleep(500);
  const position = await evaluate(`(() => {const r=${query('referral-copy-code')}.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...position, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...position, button: 'left', clickCount: 1 });
  await sleep(500);
  assert.equal(await evaluate('navigator.clipboard.readText()'), '93q74093');
  console.log('PASS: real copy button writes exactly 93q74093 to the clipboard');
  for (const [width, height] of [[320, 568], [393, 851], [430, 932], [768, 1024]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await sleep(300);
    await evaluate(`${query('referral-code-row')}.scrollIntoView({block:'center'})`);
    const box = await evaluate(`(() => {
      const row=${query('referral-code-row')},rect=row.getBoundingClientRect(),label=row.children[0].getBoundingClientRect(),group=row.children[1].getBoundingClientRect(),footer=${query('referral-bottom-bar')}.getBoundingClientRect();
      return {left:rect.left,right:rect.right,labelLeft:label.left,groupRight:group.right,footerBottom:footer.bottom,copyBackground:getComputedStyle(${query('referral-copy-code')}).backgroundColor};
    })()`);
    assert.ok(box.left >= 0 && box.right <= width + 1);
    assert.ok(Math.abs(box.labelLeft - box.left) < 1, 'Label must align to the left edge');
    assert.ok(Math.abs(box.groupRight - box.right) < 1, 'Code and copy icon must align to the right edge');
    assert.equal(box.copyBackground, 'rgba(0, 0, 0, 0)', 'Copy icon must have no background box');
    assert.ok(Math.abs(box.footerBottom - height) < 1, 'Invite Friends must stay at the bottom');
  }
  console.log('PASS: Statistics-style left/right referral row, transparent copy icon and bottom invite bar at four sizes');
  await send('Emulation.setDeviceMetricsOverride', { width: 393, height: 851, deviceScaleFactor: 1, mobile: false });
  await sleep(300);
  await evaluate(`(() => {let el=${query('referral-code-row')};while(el){if(['auto','scroll'].includes(getComputedStyle(el).overflowY)){el.scrollTop=0;break;}el=el.parentElement;}})()`);
  await sleep(3600);
  await fs.mkdir('generated-artifacts', { recursive: true });
  const image = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
  await fs.writeFile('generated-artifacts/referral-code.jpg', Buffer.from(image.data, 'base64'));
} finally {
  ws.close();
}
