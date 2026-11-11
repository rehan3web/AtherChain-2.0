// Real 30s + 30s review timeline. Uses sample artwork, never real identity data.
// Start Chromium with --remote-debugging-port=9222 and an entered practice session.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let sequence = 0, chooser;
const pending = new Map();
ws.addEventListener('message', ({ data }) => {
  const m = JSON.parse(data);
  if (m.method === 'Page.fileChooserOpened') chooser = m.params;
  const p = pending.get(m.id); if (!p) return;
  pending.delete(m.id); m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const query = id => `document.querySelector('[data-testid="${id}"]')`;
const wait = async id => {
  for (let n = 0; n < 150; n++) { if (await evaluate(`!!${query(id)}`)) return; await sleep(400); }
  throw Error(`Missing ${id}: ${await evaluate('document.body.innerText')}`);
};
const click = async id => { await wait(id); await evaluate(`${query(id)}.click()`); await sleep(450); };
const tapDock = async id => {
  await wait(id);
  const r = await evaluate(`(() => { const r=${query(id)}.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, ...r, button: 'left', clickCount: 1 });
  await sleep(450);
};
const fill = async (id, value) => {
  await wait(id); await evaluate(`(() => {
    const el=${query(id)}; el.focus();
    Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});
    el.dispatchEvent(new Event('input',{bubbles:true}));
  })()`); await sleep(100);
};
const upload = async side => {
  chooser = undefined; await click(`kyc-${side}-library`);
  for (let n = 0; n < 30 && !chooser; n++) await sleep(100);
  assert.ok(chooser, 'Sample file picker must open');
  await send('DOM.setFileInputFiles', { files: [`${process.cwd()}/assets/images/icon.png`], backendNodeId: chooser.backendNodeId });
  await wait(`kyc-${side}-remove`); await click('kyc-next');
};
const capture = async name => {
  await fs.mkdir('generated-artifacts', { recursive: true });
  const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
  await fs.writeFile(`generated-artifacts/${name}.jpg`, Buffer.from(r.data, 'base64'));
};
const whiteSurface = async id => {
  await wait(id);
  assert.match(await evaluate(`getComputedStyle(${query(id)}).backgroundImage`), /rgb\(255, 255, 255\)/);
  assert.equal(await evaluate(`getComputedStyle(${query(id)}.querySelector('[dir="auto"]')).color`), 'rgb(24, 24, 27)');
};
try {
  await send('Emulation.setDeviceMetricsOverride', { width: 402, height: 874, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable'); await send('Page.setInterceptFileChooserDialog', { enabled: true });
  await send('Page.navigate', { url: `${process.env.APP_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN}`}/` });
  await wait('screen-dashboard'); await tapDock('dock-settings');
  await click('settings-row-appearance'); await click('appearance-dark'); await click('wallet-sheet-close');
  await click('settings-row-kyc'); await click('kyc-start'); await click('kyc-document-id'); await click('kyc-next');
  await fill('kyc-name', 'Practice Person'); await fill('kyc-fatherName', 'Practice Parent'); await fill('kyc-dob', '2000-01-01');
  await click('kyc-language'); await fill('kyc-language-search', 'English'); await click('kyc-language-en'); await click('kyc-next');
  await fill('kyc-address', 'Sample Street'); await fill('kyc-city', 'Sample City'); await fill('kyc-state', 'Sample State');
  await click('kyc-country'); await fill('kyc-country-search', 'United States'); await click('kyc-country-US'); await click('kyc-next');
  await upload('front'); await upload('back');
  await wait('kyc-result-pending'); const submitted = Date.now();
  assert.equal(await evaluate(`${query('kyc-result-status')}.innerText`), 'Pending');
  await capture('kyc-pending-dark');
  await click('kyc-done'); await click('settings-row-kyc'); await wait('kyc-result-pending');
  await wait('kyc-result-rejected');
  assert.ok(Date.now() - submitted >= 29000);
  assert.equal(await evaluate(`${query('kyc-result-status')}.innerText`), 'Rejected');
  assert.equal(await evaluate(`${query('kyc-resubmit')}.innerText`), 'Resubmit KYC');
  assert.equal(await evaluate(`!!${query('kyc-done')}`), false);
  await capture('kyc-rejected-dark');
  if (process.env.RESUBMIT_KYC === '1') {
    await click('kyc-resubmit');
    await wait('kyc-document-id');
    assert.equal(await evaluate(`!!${query('kyc-result')}`), false);
    await capture('kyc-resubmit-document-selection');
    await click('kyc-document-id'); await click('kyc-next');
    assert.equal(await evaluate(`${query('kyc-name')}.value`), '');
    console.log('PASS: rejected screen replaces Done with Resubmit KYC and opens a fresh KYC form.');
  } else {
  await wait('kyc-result-approved');
  assert.ok(Date.now() - submitted >= 59000);
  assert.equal(await evaluate(`${query('kyc-result-status')}.innerText`), 'Approved');
  await capture('kyc-approved-dark'); await click('kyc-done');
  await tapDock('dock-mining'); await wait('mining-status');
  assert.equal(await evaluate(`${query('mining-status')}.innerText`), 'Ready');
  assert.equal(await evaluate(`${query('mining-status')}.parentElement.childElementCount`), 1);
  await whiteSurface('mining-claim-surface'); await capture('mining-white-claim-dark');
  await tapDock('dock-wallet'); await whiteSurface('wallet-send-surface'); await capture('wallet-white-send-dark');
  console.log('PASS: real pending→rejected→approved timeline, reopened status, white dark-mode Claim/Send, and Ready without tick.');
  }
} finally { ws.close(); }
