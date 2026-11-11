// Uses the normal dummy login UI and isolated browser-profile mining fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.APP_URL ?? 'http://127.0.0.1:18115';
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const ws = new WebSocket(targets.find(item => item.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0, backup = null, backedUp = false;
const pending = new Map(), exceptions = [];
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
  const callback = pending.get(message.id);
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
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const query = id => `Array.from(document.querySelectorAll('[data-testid="${id}"]')).find(el=>el.getClientRects().length>0&&!el.closest('[aria-hidden="true"]'))`;
const exists = id => evaluate(`!!${query(id)}`);
const text = id => evaluate(`${query(id)}.innerText`);
const wait = async id => {
  for (let n = 0; n < 150; n++) { if (await exists(id)) return; await sleep(200); }
  throw Error(`Missing ${id}: ${await evaluate('document.body.innerText')}`);
};
const click = async id => {
  await wait(id); await evaluate(`${query(id)}.scrollIntoView({block:'nearest'})`);
  if (id.startsWith('dock-')) {
    const box = await rect(id), x = box.x + box.width / 2, y = box.y + box.height / 2;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  } else await evaluate(`${query(id)}.click()`);
  await sleep(300);
};
const fill = async (id, value) => {
  await wait(id);
  await evaluate(`(() => {const el=${query(id)};el.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await sleep(200);
};
const rect = id => evaluate(`(() => {const r=${query(id)}.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};})()`);
const slide = async id => {
  await wait(`${id}-handle`);
  await evaluate(`${query(id)}.scrollIntoView({block:'center'})`); await sleep(450);
  const track = await rect(id), handle = await rect(`${id}-handle`);
  const x = handle.x + handle.width / 2, y = handle.y + handle.height / 2;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  for (let step = 1; step <= 20; step++) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + (track.x + track.width - 20 - x) * step / 20, y, button: 'left', buttons: 1 });
    await sleep(25);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: track.x + track.width - 20, y, button: 'left', clickCount: 1 });
};
const capture = async name => {
  await sleep(600);
  await fs.mkdir('generated-artifacts', { recursive: true });
  const image = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
  await fs.writeFile(`generated-artifacts/statistics-${name}.jpg`, Buffer.from(image.data, 'base64'));
};
const fixture = () => evaluate(`(() => {
  const key=date=>date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  const today=new Date(),yesterday=new Date(),before=new Date();
  yesterday.setDate(today.getDate()-1);before.setDate(today.getDate()-2);
  return {today:key(today),state:{version:1,cycleStartedAt:yesterday.getTime(),claims:2,claimDays:[key(before),key(yesterday)]}};
})()`);
const openStatistics = async () => { await click('dashboard-statistics'); await wait('statistics-calendar'); };

try {
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 402, height: 874, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}/` });
  for (let n = 0; n < 150; n++) {
    if (await exists('screen-dashboard') || await exists('welcome-login') || await exists('login-identifier')) break;
    await sleep(200);
  }
  if (!await exists('screen-dashboard')) {
    await send('Page.navigate', { url: `${base}/login` });
    await fill('login-identifier', 'practice_user');
    await click('login-next');
    await fill('login-password', 'made-up-123');
    await click('login-submit');
    await wait('screen-dashboard');
  }
  backup = await evaluate(`localStorage.getItem('demo-mining-cycle-v1')`);
  backedUp = true;
  const prepared = await fixture();
  await evaluate(`localStorage.setItem('demo-mining-cycle-v1',${JSON.stringify(JSON.stringify(prepared.state))})`);
  await send('Page.navigate', { url: `${base}/` });
  await wait('dashboard-statistics');
  await openStatistics();
  assert.equal(await text('statistics-streak'), '2 Days');
  assert.equal(await text('statistics-total-swap'), '0');
  assert.equal(await text('statistics-total-transfer'), '0', 'Initial sample payment must not count as a user transfer');
  assert.equal(await exists(`statistics-claimed-${prepared.today}`), false);
  const initialMonth = await text('statistics-month');
  await click('statistics-prev-month');
  assert.notEqual(await text('statistics-month'), initialMonth);
  await click('statistics-next-month');
  assert.equal(await text('statistics-month'), initialMonth);
  await click('statistics-back');
  await click('dock-mining');
  await click('mining-claim');
  for (let n = 0; n < 80; n++) {
    if (await evaluate(`JSON.parse(localStorage.getItem('demo-mining-cycle-v1')).claims`) === 3) break;
    await sleep(100);
  }
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('demo-mining-cycle-v1')).claims`), 3);
  await click('dock-index');
  await openStatistics();
  await wait(`statistics-claimed-${prepared.today}`);
  assert.equal(await text('statistics-streak'), '3 Days');
  assert.equal(await text('statistics-total-transfer'), '0', 'Mining claim must not count as a wallet transfer');
  await send('Page.reload', { ignoreCache: true });
  await sleep(1000); await wait('statistics-calendar');
  await wait(`statistics-claimed-${prepared.today}`);
  assert.equal(await text('statistics-streak'), '3 Days', 'Claim day and streak must survive reload');
  console.log('PASS: dashboard navigation, month switching, actual mining claim, same-day verification and reload persistence');

  await click('statistics-back');
  await click('dock-wallet');
  await click('wallet-send');
  await fill('wallet-send-recipient-email', 'statistics@example.com');
  await click('wallet-key-1');
  await click('wallet-send-submit');
  await slide('wallet-send-slider');
  await wait('wallet-send-receipt');
  await sleep(800); await click('wallet-send-receipt-close');
  await click('wallet-activity');
  await click('wallet-swap-key-2');
  await click('wallet-swap-review');
  await slide('wallet-swap-slider');
  await wait('wallet-swap-receipt');
  await sleep(800); await click('wallet-receipt-close');
  await click('dock-index');
  await openStatistics();
  assert.equal(await text('statistics-total-swap'), '1');
  assert.equal(await text('statistics-total-transfer'), '1');
  await click('statistics-back');
  await openStatistics();
  assert.equal(await text('statistics-total-swap'), '1', 'Reopening the page must not double-count a swap');
  assert.equal(await text('statistics-total-transfer'), '1');
  console.log('PASS: completed Swap and Send update the right totals without counting sample payments or mining claims');

  for (const theme of ['light', 'dark']) {
    await click('statistics-back');
    await click('dock-settings');
    await click('settings-row-appearance');
    await click(`appearance-${theme}`);
    await click('wallet-sheet-close');
    await click('dock-index');
    await openStatistics();
    await send('Emulation.setDeviceMetricsOverride', { width: 402, height: 1100, deviceScaleFactor: 1, mobile: false });
    await evaluate(`${query('statistics-scroll')}.scrollTop=0`);
    for (let n = 0; n < 30 && await exists('global-toast-stack'); n++) await sleep(200);
    await capture(theme);
    for (const [width, height] of [[280, 600], [320, 568], [360, 740], [375, 812], [393, 851], [402, 874], [412, 915], [430, 932], [600, 960], [768, 1024], [844, 390], [1024, 768]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: width === 393 ? 2.75 : width <= 430 ? 3 : 1.5, mobile: false });
      await sleep(300);
      const grid = await evaluate(`(() => {
        const calendar=${query('statistics-calendar')}, bounds=calendar.getBoundingClientRect();
        const weekdays=${query('statistics-weekdays')};
        const rows=Array.from(calendar.querySelectorAll('[data-testid]')).filter(el=>/^statistics-week-\\d+$/.test(el.dataset.testid));
        return {left:bounds.left,right:bounds.right,rows:[weekdays,...rows].map(row=>({
          wrap:getComputedStyle(row).flexWrap,
          cells:Array.from(row.children).map(cell=>{const r=cell.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,width:r.width};})
        }))};
      })()`);
      for (const row of grid.rows) {
        assert.equal(row.cells.length, 7, 'Every calendar row must keep all seven columns');
        assert.equal(row.wrap, 'nowrap', 'Native date cells must never depend on wrapping fractional widths');
        assert.ok(Math.abs(row.cells[0].left - grid.left) <= 1, 'No extra left calendar gap');
        assert.ok(Math.abs(row.cells[6].right - grid.right) <= 1, 'Sunday must fill the right edge without an extra gap');
        for (const cell of row.cells) {
          assert.ok(Math.abs(cell.top - row.cells[0].top) <= 1, 'Sunday must not wrap onto a second row');
          assert.ok(Math.abs(cell.width - row.cells[0].width) <= 1, 'All seven cells must have equal widths');
        }
      }
      await evaluate(`${query('statistics-total-transfer')}.scrollIntoView({block:'end'})`);
      assert.ok((await rect('statistics-total-transfer')).bottom <= height, 'Last metric must be reachable on short phones');
      assert.equal(await evaluate(`${query('statistics-screen')}.scrollWidth<=${query('statistics-screen')}.clientWidth+1`), true);
    }
  }
  console.log('PASS: seven aligned columns without side gaps in light/dark, across 12 phone, tablet and landscape sizes');

  await evaluate(`localStorage.setItem('demo-mining-cycle-v1',${JSON.stringify(JSON.stringify(prepared.state))})`);
  await send('Page.navigate', { url: `${base}/` });
  await wait('screen-dashboard');
  await click('dock-mining');
  await wait('mining-claim');
  await evaluate(`window.__statisticsSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='demo-mining-cycle-v1')throw new Error('Statistics test save failure');return window.__statisticsSetItem.call(this,key,value)}`);
  await click('mining-claim');
  for (let n = 0; n < 60; n++) {
    if (await evaluate(`document.body.innerText.includes('Statistics test save failure')`)) break;
    await sleep(100);
  }
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('demo-mining-cycle-v1')).claims`), 2);
  await evaluate(`Storage.prototype.setItem=window.__statisticsSetItem;delete window.__statisticsSetItem`);
  await click('dock-index');
  await openStatistics();
  assert.equal(await exists(`statistics-claimed-${prepared.today}`), false, 'Failed claim persistence must not create a verified day');
  assert.equal(await text('statistics-streak'), '2 Days');
  assert.deepEqual(exceptions, []);
  console.log('PASS: failed claim saving leaves the calendar and streak unchanged');
} catch (error) {
  await capture('failure');
  console.error(await evaluate('document.body.innerText'));
  throw error;
} finally {
  await evaluate(`if(window.__statisticsSetItem){Storage.prototype.setItem=window.__statisticsSetItem;delete window.__statisticsSetItem}`);
  if (backedUp) await evaluate(backup === null ? `localStorage.removeItem('demo-mining-cycle-v1')` : `localStorage.setItem('demo-mining-cycle-v1',${JSON.stringify(backup)})`);
  ws.close();
}
