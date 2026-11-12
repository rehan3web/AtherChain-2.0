// Isolated browser fixtures only. All API requests are intercepted; no real identity data.
// Start Chromium with --use-fake-ui-for-media-stream --use-fake-device-for-media-stream.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const directory = 'generated-artifacts/kyc-checks';
await fs.mkdir(directory, { recursive: true });
await fs.writeFile(`${directory}/document.png`, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4X8AAAAASUVORK5CYII=', 'base64'));
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const target = targets.find(item => item.type === 'page'); assert.ok(target);
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0, chooser, submissions = 0;
const pending = new Map(), multipart = [], consoleErrors = [];
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
ws.addEventListener('message', ({ data }) => {
  const event = JSON.parse(data);
  if (event.id) {
    const call = pending.get(event.id); if (!call) return; pending.delete(event.id);
    if (event.error) call.reject(new Error(JSON.stringify(event.error))); else call.resolve(event.result);
  } else if (event.method === 'Runtime.consoleAPICalled' && event.params.type === 'error') {
    consoleErrors.push(event.params.args.map(arg => arg.value ?? arg.description ?? '').join(' '));
  } else if (event.method === 'Page.fileChooserOpened') chooser = event.params;
  else if (event.method === 'Fetch.requestPaused') {
    const { requestId, request } = event.params;
    const route = new URL(request.url).pathname.replace(/^\/api/, '');
    let status = 200, result = {};
    if (route === '/auth/login') result = { token: 'fixture-kyc-session' };
    else if (route === '/user/me') result = { id: 'fixture-owner', email: 'fixture@example.test', username: 'fixture',
      is_email_verified: true, twofa_enabled: true, kyc_status: submissions >= 2 ? 'pending' : 'not_submitted' };
    else if (route === '/user/kyc/status') result = { status: submissions >= 2 ? 'pending' : 'not_submitted', eligibility: { eligible: true } };
    else if (route === '/user/kyc/submit') {
      submissions++; multipart.push(request);
      if (submissions === 1) { status = 500; result = { message: 'Fixture submission failed' }; }
      else result = { status: 'pending', message: 'Submitted for manual review' };
    }
    // Deliberately never continue any API request, even an unexpected one.
    setTimeout(() => { void send('Fetch.fulfillRequest', { requestId, responseCode: status,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
      body: Buffer.from(JSON.stringify(result)).toString('base64') }); }, route === '/user/kyc/submit' ? 1200 : 100);
  }
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const evaluate = async (expression, userGesture = false) => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const q = id => `document.querySelector('[data-testid="${id}"]')`;
async function until(expression) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) { if (await evaluate(`!!(${expression})`)) return; await sleep(150); }
  throw new Error(`Missing ${expression}: ${await evaluate('document.body.innerText')}`);
}
const click = async id => { await until(q(id)); await evaluate(`${q(id)}.click()`, true); await sleep(250); };
const fill = async (id, value) => {
  await until(q(id));
  await evaluate(`(() => { const el=${q(id)}; const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await sleep(100);
};
const capture = async name => {
  await sleep(300); const image = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(`${directory}/${name}.png`, Buffer.from(image.data, 'base64'));
};
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
try {
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 402, height: 874, deviceScaleFactor: 1, mobile: false });
  await send('Page.setInterceptFileChooserDialog', { enabled: true });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*', requestStage: 'Request' }] });
  await send('Storage.clearDataForOrigin', { origin: base, storageTypes: 'local_storage' });
  await send('Page.navigate', { url: base + '/login' });
  await fill('login-identifier', 'fixture@example.test'); await click('login-next');
  await fill('login-password', 'fixture-password'); await click('login-submit');
  await until('localStorage.getItem("ather_token") === "fixture-kyc-session"');
  await send('Page.navigate', { url: base + '/kyc' });
  await click('kyc-start'); await click('kyc-document-passport'); await click('kyc-next');
  await fill('kyc-name', 'Sample Person'); await fill('kyc-fatherName', 'Sample Parent');
  await fill('kyc-dob', '2000-01-01'); await fill('kyc-document-number', 'SAMPLE'); await fill('kyc-document-expiry', '2099-12-31');
  await click('kyc-language'); await fill('kyc-language-search', 'English'); await click('kyc-language-en');
  await until(`${q('kyc-language-search')} === null`); await click('kyc-next');
  await fill('kyc-address', 'Sample Street'); await fill('kyc-city', 'Sample City'); await fill('kyc-state', 'Sample State');
  await click('kyc-country'); await fill('kyc-country-search', 'Pakistan'); await click('kyc-country-PK');
  await until(`${q('kyc-country-search')} === null`); await click('kyc-next');
  for (const side of ['front', 'back']) {
    chooser = null; await click(`kyc-${side}-library`);
    const deadline = Date.now() + 5000;
    while (!chooser && Date.now() < deadline) await sleep(100);
    assert.ok(chooser, 'Real document picker opened');
    await send('DOM.setFileInputFiles', { files: [path.resolve(`${directory}/document.png`)], backendNodeId: chooser.backendNodeId });
    await until(q(`kyc-${side}-remove`)); await click('kyc-next');
  }
  await until(q('kyc-face-capture')); await sleep(1000);
  assert.equal(submissions, 0, 'Mounting the camera step must not submit');
  await capture('single-camera-action');
  await click('kyc-face-capture'); await until(q('kyc-face-loading'));
  await until(`document.querySelector('[data-testid^="toast-error-"]')`);
  await until(`${q('kyc-face-capture')}?.getAttribute('aria-disabled') !== 'true'`);
  assert.equal(submissions, 1); await capture('recoverable-error');
  await click('kyc-face-capture'); await until(q('kyc-result-pending'));
  assert.equal(submissions, 2, 'One failed attempt plus one deliberate new photo');
  assert.equal(await evaluate(`${q('kyc-result-status')}.innerText`), 'Pending');
  for (const request of multipart) {
    const contentType = Object.entries(request.headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1];
    assert.match(contentType, /multipart\/form-data; boundary=/);
    assert.ok(request.hasPostData);
  }
  await capture('pending-review');
  assert.deepEqual(consoleErrors, [], 'KYC must not produce browser console errors');
  assert.equal(await evaluate(`!!document.querySelector('[data-testid^="toast-error-"]')`), false, 'Successful retry clears stale error toast');
  console.log('PASS: full KYC form, real document pickers, explicit single fake-camera capture, spinner, red-toast retry and pending review; every API call intercepted.');
} finally { await send('Page.navigate', { url: 'about:blank' }); ws.close(); }
