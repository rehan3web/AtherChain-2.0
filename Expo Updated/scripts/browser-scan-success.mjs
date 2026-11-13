// Hermetic UI test: simulates a barcode callback, never approves a real browser login.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0, approvals = 0;
const pending = new Map();
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
    let response = {}, status = 200;
    if (route === '/user/me') response = { id: 'scan-fixture', email: 'fixture@test.example', username: 'fixture', role: 'user' };
    else if (route === '/auth/qr/approve') { approvals++; await sleep(700); response = { success: true }; }
    else { status = 404; response = { message: 'Unexpected fixture request' }; }
    await send('Fetch.fulfillRequest', { requestId, responseCode: status,
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
const base = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://127.0.0.1:5000';
try {
  await fs.mkdir('generated-artifacts/scan-success', { recursive: true });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Browser.grantPermissions', { origin: base, permissions: ['videoCapture'] });
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('ather_token','scan-fixture');window.confirm=()=>true;`,
  });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 402, height: 874, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: `${base}/scan` });
  const detect = invoke => `(() => {
    const element=${q('scan-screen')};
    if(!element) return false;
    const key=Object.keys(element).find(key=>key.startsWith('__reactFiber'));
    const stack=[element[key]];
    while(stack.length) {
      const fiber=stack.pop(); if(!fiber) continue;
      if(typeof fiber.memoizedProps?.onBarcodeScanned==='function') {
        ${invoke ? `fiber.memoizedProps.onBarcodeScanned({data:'${'a'.repeat(64)}'});` : ''}
        return true;
      }
      if(fiber.child) stack.push(fiber.child);
      if(fiber.sibling) stack.push(fiber.sibling);
    }
    return false;
  })()`;
  await until(detect(false));
  assert.equal(await evaluate(detect(true)), true);
  await until(`!!${q('scan-approving')}`);
  await until(`!!${q('twofa-success-circle')}`);
  const path = `${q('twofa-success-circle')}.querySelector('path')`;
  const initial = await evaluate(`Number(${path}.getAttribute('stroke-dashoffset'))`);
  await until(`Number(${path}.getAttribute('stroke-dashoffset')) === 0`);
  assert.ok(initial > 0, 'The tick must draw progressively, not appear as a static check');
  assert.equal(approvals, 1);
  assert.equal(await evaluate(`!!${q('scan-camera')} || !!${q('scan-frame')} || !!${q('scan-line')} || !!document.querySelector('video')`), false);
  assert.equal(await evaluate(`getComputedStyle(${q('scan-screen')}).backgroundColor`), 'rgb(29, 27, 25)');
  assert.equal(await evaluate(`document.body.innerText.includes('Scan Completed')`), true);
  const image = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
  await fs.writeFile('generated-artifacts/scan-success/completed.jpg', Buffer.from(image.data, 'base64'));
  console.log('Verified actual OTP tick drawing, opaque success background, and complete camera/frame removal after mocked approval.');
} finally { ws.close(); }
