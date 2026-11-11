// Requires Chromium --remote-debugging-port=9222 with a normal dummy-entry session.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map();
const exceptions = [];
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data), callback = pending.get(message.id);
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
  if (!callback) return;
  pending.delete(message.id);
  if (message.error) callback.reject(Error(JSON.stringify(message.error))); else callback.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const query = id => `document.querySelector('[data-testid="${id}"]')`;
const wait = async id => {
  for (let n = 0; n < 120; n++) { if (await evaluate(`!!${query(id)}`)) return; await sleep(400); }
  throw Error(`Missing ${id}: ${await evaluate('document.body.innerText')}`);
};
const rect = async id => evaluate(`(() => {
  const r=${query(id)}.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height};
})()`);
const click = async id => { await wait(id); await evaluate(`${query(id)}.click()`); await sleep(450); };
const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, ...extra });
const tap = async id => {
  await wait(id); const r = await rect(id);
  await mouse('mousePressed', r.x + r.width / 2, r.y + r.height / 2, { button: 'left', clickCount: 1 });
  await mouse('mouseReleased', r.x + r.width / 2, r.y + r.height / 2, { button: 'left', clickCount: 1 });
  await sleep(450);
};
const slide = async id => {
  await wait(`${id}-handle`);
  await evaluate(`${query(id)}.scrollIntoView({block:'center'})`); await sleep(450);
  const track = await rect(id), handle = await rect(`${id}-handle`);
  const x = handle.x + handle.width / 2, y = handle.y + handle.height / 2;
  await mouse('mousePressed', x, y, { button: 'left', clickCount: 1 });
  for (let n = 1; n <= 16; n++) {
    await mouse('mouseMoved', x + (track.x + track.width - 22 - x) * n / 16, y, { button: 'left', buttons: 1 });
    await sleep(25);
  }
  await mouse('mouseReleased', track.x + track.width - 22, y, { button: 'left', clickCount: 1 });
};
const capture = async name => {
  // Native Modal slide animations can still be running when its DOM first appears.
  await sleep(650);
  await fs.mkdir('generated-artifacts', { recursive: true });
  const image = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
  await fs.writeFile(`generated-artifacts/${name}${process.env.THEME ? `-${process.env.THEME}` : ''}.jpg`, Buffer.from(image.data, 'base64'));
};
const checkReceiptLayout = async rootId => {
  for (const [width, height] of [[320, 568], [375, 667], [402, 874], [430, 932]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await sleep(450);
    const result = await evaluate(`(() => {
      const body=${query(`${rootId}-body`)};
      const row=${query(rootId === 'wallet-send-receipt' ? 'wallet-send-receipt-status' : 'wallet-receipt-status')};
      body.scrollTop=body.scrollHeight;
      return {rowHeight:row.getBoundingClientRect().height, scrollable:body.scrollHeight>body.clientHeight+1};
    })()`);
    assert.equal(result.rowHeight, 88, 'Original spacious receipt rows must remain unchanged on short screens');
    assert.equal(result.scrollable, true, 'Original receipt scrolling is restored');
    await sleep(100);
    const footer = await rect(`${rootId}-footer-last-row`);
    assert.ok(footer.y >= 0 && footer.y + footer.height <= height + 1, `Last row must remain reachable: ${JSON.stringify(footer)}`);
    await evaluate(`${query(`${rootId}-body`)}.scrollTop=0`);
    if (width === 320 || width === 402) await capture(`restored-${rootId}-${width}x${height}`);
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 402, height: 874, deviceScaleFactor: 1, mobile: false });
  await sleep(400);
  await evaluate(`${query(`${rootId}-body`)}.scrollTop=0`);
};
const recipientEmail = process.env.LONG_RECEIPT ? `${'long'.repeat(12)}@example.com` : 'friend@example.com';
const checkToast = async (title, expectedTop = 91) => {
  await wait('global-toast-stack');
  // Receipt Modals slide in after mounting; measure their settled position.
  await sleep(650);
  assert.match(await evaluate(`${query('global-toast-stack')}.innerText`), title);
  const box = await rect('global-toast-stack');
  assert.ok(Math.abs(box.y - expectedTop) <= 2, `Toast must be at the intended top clearance: ${JSON.stringify(box)}`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-testid="global-toast-stack"]').length`), 1);
};
try {
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 402, height: 874, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${process.env.APP_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN}`}/` });
  await wait('screen-dashboard');
  if (process.env.THEME) {
    assert.ok(['light', 'dark'].includes(process.env.THEME));
    await tap('dock-settings'); await click('settings-row-appearance');
    await click(`appearance-${process.env.THEME}`); await click('wallet-sheet-close');
  }
  await tap('dock-wallet'); await wait('wallet-balance'); await sleep(1200);
  assert.equal(await evaluate(`${query('wallet-balance')}.getAttribute('aria-label')`), 'Balance 52002.50 ATH');
  assert.equal(await evaluate(`${query('wallet-balance-unit')}.innerText`), 'ATH');
  assert.doesNotMatch(await evaluate(`${query('wallet-balance-amount')}.innerText`), /ATH/);
  const amountBox = await rect('wallet-balance-amount'), unitBox = await rect('wallet-balance-unit');
  assert.ok(unitBox.x >= amountBox.x + amountBox.width - 2 && unitBox.height < amountBox.height, 'ATH belongs after the numeric balance in smaller type');
  await capture('wallet-ath-balance');
  assert.equal(await evaluate(`!!document.querySelector('[data-testid="wallet-network"],[data-testid="wallet-add-network"],[data-testid="network-wallet-screen"]')`), false, 'No alternate-network selector or wallet must remain');
  await wait('wallet-settings');
  await click('wallet-receive');
  await wait('wallet-receive-details');
  await click('wallet-receive-method-address');
  await wait('wallet-receive-qr-address');
  await capture('atherchain-receive');
  await click('wallet-sheet-close');
  await click('wallet-send'); await wait('wallet-send-recipient-email');
  await evaluate(`(() => {
    const el=${query('wallet-send-recipient-email')}; el.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(recipientEmail)});
    el.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await click('wallet-key-1'); await click('wallet-send-submit'); await slide('wallet-send-slider');
  await wait('wallet-send-receipt'); await checkToast(/Send confirmed|Demo send confirmed/); await capture('wallet-send-top-toast');
  assert.match(await evaluate(`${query('wallet-send-receipt')}.innerText`), /1\.00 ATH/);
  assert.doesNotMatch(await evaluate(`${query('wallet-send-receipt-summary')}.innerText`), /To |@example.com/);
  assert.ok((await evaluate(`${query('wallet-send-receipt')}.innerText`)).includes(recipientEmail));
  await click('wallet-send-reference-copy');
  await checkReceiptLayout('wallet-send-receipt');
  await click('wallet-send-receipt-close');
  assert.match(await evaluate(`(${query('wallet-activity-list')} ?? ${query('wallet-last-transaction')}).innerText`), /1\.00 ATH/);
  await click('wallet-view-all'); await wait('screen-transactions');
  const row = `Array.from(document.querySelectorAll('[data-testid^="txn-history-row-"]')).find(el => el.innerText.includes(${JSON.stringify(recipientEmail)}))`;
  assert.match(await evaluate(`${row}.innerText`), /−1\.00 ATH/);
  await evaluate(`${row}.click()`); await wait('wallet-send-receipt');
  assert.equal(await evaluate(`${query('wallet-send-receipt-amount')}.innerText`), '1.00 ATH');
  assert.doesNotMatch(await evaluate(`${query('wallet-send-receipt-summary')}.innerText`), /To |@example.com/);
  await checkReceiptLayout('wallet-send-receipt');
  await capture('wallet-reopened-receipt-suffix-amount-date');
  await click('wallet-send-receipt-close'); await click('transactions-back');
  await click('wallet-activity');
  await wait('wallet-swap-token-0');
  assert.match(await evaluate(`${query('wallet-swap-token-0')}.innerText`), /^AT$/);
  assert.match(await evaluate(`${query('wallet-swap-token-1')}.innerText`), /^ATH$/);
  assert.equal(await evaluate(`!!document.querySelector('[data-testid^="wallet-swap-select-"],[data-testid="wallet-swap-reverse"],[data-testid^="wallet-swap-coin-"]')`), false);
  for (const symbol of ['AT', 'ATH']) {
    assert.equal(await evaluate(`${query(`wallet-swap-logo-${symbol}-ather`)}.querySelector('img').naturalWidth>0`), true);
  }
  if (process.env.THEME) for (const symbol of ['AT', 'ATH']) {
    assert.equal(await evaluate(`${query(`wallet-swap-logo-${symbol}-ather`)}.querySelector('img').alt`),
      `Ather logo ${process.env.THEME === 'light' ? 'black' : 'white'}`);
  }
  await wait('wallet-swap-entry');
  const entryBox = await rect('wallet-swap-entry');
  assert.ok(entryBox.y < 200 && entryBox.height > 500, `Swap opens full screen immediately: ${JSON.stringify(entryBox)}`);
  assert.equal(await evaluate(`${query('wallet-swap-entry')}.querySelectorAll('input,textarea').length`), 0);
  assert.equal(await evaluate(`${query('wallet-swap-review')}.getAttribute('aria-disabled')`), 'true');
  assert.match(await evaluate(`${query('wallet-swap-rate')}.innerText`), /1 AT = 1 ATH/);
  await click('wallet-swap-max');
  assert.equal(await evaluate(`${query('wallet-swap-amount-0')}.innerText`), '52001.50');
  assert.equal(await evaluate(`${query('wallet-swap-amount-1')}.innerText.replaceAll(',','')`), '52001.5');
  for (let i = 0; i < 3; i++) await click('wallet-swap-key-del');
  await click('wallet-swap-key-1');
  await wait('wallet-swap-error');
  assert.equal(await evaluate(`${query('wallet-swap-review')}.getAttribute('aria-disabled')`), 'true');
  for (let i = 0; i < 6; i++) await click('wallet-swap-key-del');
  for (const key of ['2', 'dot', '5']) await click(`wallet-swap-key-${key}`);
  assert.equal(await evaluate(`${query('wallet-swap-amount-0')}.innerText`), '2.5');
  assert.equal(await evaluate(`${query('wallet-swap-amount-1')}.innerText`), '2.5');
  assert.equal(await evaluate(`!!${query('wallet-swap-error')}`), false);
  assert.doesNotMatch(await evaluate(`${query('wallet-swap-entry')}.innerText`), /\$|BTC|HYPE/);
  for (const [width, height] of [[375, 667], [402, 874]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await sleep(500);
    // The retained spacious Swap fields scroll on short screens.
    await evaluate(`${query('wallet-swap-review')}.scrollIntoView({block:'end'})`);
    await sleep(200);
    const keypad = await rect('wallet-swap-keypad'), button = await rect('wallet-swap-review');
    assert.equal(keypad.height, 224, 'Reuse the unchanged wallet amount keypad');
    assert.ok(keypad.y >= 0 && button.y >= keypad.y + keypad.height && button.y + button.height <= height,
      `Keypad and bottom Swap button must be reachable by scrolling on ${width}×${height}: ${JSON.stringify({ keypad, button })}`);
    await capture(`wallet-swap-fullscreen-${width}x${height}`);
  }
  await capture('wallet-swap-at-ath');
  await click('wallet-swap-review');
  await wait('wallet-swap-review-details');
  assert.doesNotMatch(await evaluate(`${query('wallet-swap-review-details')}.innerText`), /\$|BTC|HYPE/);
  assert.match(await evaluate(`${query('wallet-swap-review-fee')}.innerText`), /0 AT/);
  assert.equal(await evaluate(`${query('wallet-swap-review-pay')}.innerText`), '2.5 AT');
  assert.equal(await evaluate(`${query('wallet-swap-review-receive')}.innerText`), '2.5 ATH');
  await capture('wallet-swap-at-ath-review');
  await slide('wallet-swap-slider'); await wait('wallet-swap-receipt');
  await checkToast(/Swap confirmed/); await capture('wallet-swap-top-toast');
  assert.equal(await evaluate(`${query('wallet-receipt-pay')}.innerText`), '2.5 AT');
  assert.equal(await evaluate(`${query('wallet-receipt-receive')}.innerText`), '2.5 ATH');
  assert.doesNotMatch(await evaluate(`${query('wallet-swap-receipt')}.innerText`), /\$|BTC|HYPE/);
  await click('wallet-swap-copy-reference');
  await checkReceiptLayout('wallet-swap-receipt');
  await click('wallet-receipt-close'); await tap('dock-index');
  await click('dashboard-referral'); await click('referral-invite');
  await checkToast(/Invitation copied|Could not share invitation/, 79);
  await capture('referral-original-top-toast');
  for (const route of ['networks', 'network-wallet?network=ethereum', 'add-network']) {
    const response = await fetch(`${process.env.APP_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN}`}/${route}`);
    assert.equal(response.status, 404, `Removed route ${route} must not reopen`);
  }
  assert.deepEqual(exceptions, [], 'No uncaught browser errors');
  console.log('PASS: AtherChain Receive remains usable, network selector is absent and all three removed routes are unavailable.');
  console.log(`PASS: AT→ATH swap cards, review, token-denominated fees, receipt, supplied logos${process.env.THEME ? ` in ${process.env.THEME} mode` : ''}; Send/Swap and Referral toast positions preserved.`);
} finally { ws.close(); }
