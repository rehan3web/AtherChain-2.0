// Hermetic browser fixture. All API requests, including uploads, are intercepted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const fixturePaths = ['assets/images/confirmed-badge.png', 'assets/images/ather-logo-black.png'].map(file => path.resolve(file));
const fixtureBytes = await Promise.all(fixturePaths.map(file => fs.readFile(file)));
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0, uploads = 0, downloads = 0, imageUrl = null, chooser, failNextUpload = false;
const pending = new Map(), unexpected = [], errors = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
ws.addEventListener('message', async ({ data }) => {
  const message = JSON.parse(data), callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    if (message.error) callback.reject(Error(JSON.stringify(message.error))); else callback.resolve(message.result);
  }
  if (message.method === 'Page.fileChooserOpened') chooser?.(message.params.backendNodeId);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = message.params, route = new URL(request.url).pathname.replace(/^\/api/, '');
  let body, status = 200, type = 'application/json', binary;
  if (route === '/user/profile/image' && request.method === 'POST') {
    const contentType = Object.entries(request.headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1];
    assert.match(contentType, /^multipart\/form-data; boundary=/);
    uploads++;
    await sleep(350);
    if (failNextUpload) { failNextUpload = false; status = 500; body = { message: 'Fixture upload rejected' }; }
    else { imageUrl = `/uploads/profiles/photo-${uploads}.png`; body = { imageUrl, message: 'Profile image updated' }; }
  } else if (request.method !== 'GET') {
    unexpected.push(`${request.method} ${route}`); status = 405; body = { message: 'Unexpected fixture mutation' };
  } else if (route === '/user/me') body = {
    id: 'profile-photo-fixture', first_name: 'Profile', last_name: 'Fixture', username: 'photo_fixture',
    profile_image: imageUrl, at_balance: '100', twofa_enabled: true,
  };
  else if (route.startsWith('/uploads/profiles/')) {
    downloads++; binary = fixtureBytes[1]; type = 'image/png';
  }
  else if (route === '/mining/status') body = { canMine: false, timeLeft: 3600, currentYield: 2, dailyReward: 2 };
  else if (route === '/user/statistics') body = { miningCalendar: [] };
  else if (route === '/transactions') body = { data: [], meta: { totalPages: 1 } };
  else { unexpected.push(`GET ${route}`); status = 404; body = { message: 'Unknown fixture endpoint' }; }
  await send('Fetch.fulfillRequest', { requestId, responseCode: status,
    responseHeaders: [{ name: 'Content-Type', value: type }],
    body: (binary ?? Buffer.from(JSON.stringify(body))).toString('base64') });
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const query = id => `document.querySelector('[data-testid="${id}"]')`;
async function until(expression, label) {
  for (let attempt = 0; attempt < 240; attempt++) {
    if (await evaluate(expression)) return;
    await sleep(150);
  }
  throw Error(`Missing ${label}: ${await evaluate('document.body.innerText')}`);
}
const wait = id => until(`!!${query(id)}`, id);
async function click(id) {
  await wait(id);
  if (id.startsWith('dock-')) {
    const point = await evaluate(`(() => { const r = ${query(id)}.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else await evaluate(`${query(id)}.click()`);
}
async function choose(file) {
  const opened = new Promise(resolve => { chooser = resolve; });
  await click('settings-edit-profile');
  const backendNodeId = await Promise.race([opened, sleep(10_000).then(() => { throw Error('Photo picker did not open'); })]);
  await send('DOM.setFileInputFiles', { backendNodeId, files: [file] });
  chooser = undefined;
}
async function image(id) {
  await until(`(() => {
    const node = ${query(id)}, img = node?.tagName === 'IMG' ? node : node?.querySelector('img');
    return !!img && img.complete && img.naturalWidth > 0 && img.src.startsWith('blob:');
  })()`, `decoded local ${id}`);
  return evaluate(`(() => {const node=${query(id)};return (node.tagName==='IMG'?node:node.querySelector('img')).src;})()`);
}
async function entries() {
  return evaluate(`(async () => {
    const bucket=await caches.open('ather-profile-photos-v1'), keys=await bucket.keys();
    return Promise.all(keys.map(async key => {const response=await bucket.match(key);return {
      key:key.url,source:decodeURIComponent(response.headers.get('x-profile-photo-source')),size:(await response.blob()).size
    }}));
  })()`);
}
async function navigate() {
  const previous = await evaluate('window.__profileFixtureDocument ?? null');
  await send('Page.navigate', { url: 'http://127.0.0.1:5000/settings' });
  await until(`!!window.__profileFixtureDocument && window.__profileFixtureDocument !== ${JSON.stringify(previous)}`,
    'new application document');
}
await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable');
await send('Page.setInterceptFileChooserDialog', { enabled: true });
await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*' }] });
await send('Emulation.setDeviceMetricsOverride', { width: 402, height: 874, deviceScaleFactor: 1, mobile: true });
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.__profileFixtureDocument=Math.random().toString(36);
    try {localStorage.setItem('ather_token','profile-photo-fixture-only');} catch {}`,
});
try {
  await fs.mkdir('generated-artifacts/profile-photo-browser', { recursive: true });
  await navigate(); await wait('settings-edit-profile');
  await until(`${query('settings-edit-profile')}?.getAttribute('aria-disabled') !== 'true'`, 'enabled pencil');
  await choose(fixturePaths[0]);
  const first = await image('settings-gradient-avatar-image');
  assert.equal(uploads, 1); assert.equal(downloads, 0, 'The selected image should seed local cache without downloading');
  assert.equal((await entries()).length, 1);
  assert.equal((await entries())[0].size, fixtureBytes[0].length);
  console.log('Pencil → select → backend upload → local avatar: no image download');
  await click('dock-index'); await image('dashboard-gradient-avatar-image');
  assert.equal(downloads, 0);
  await navigate(); await image('settings-gradient-avatar-image');
  assert.equal(downloads, 0, 'A full app restart should reuse the persisted image');
  console.log('Dashboard and restarted app reused the persisted local image');
  const previous = await image('settings-gradient-avatar-image');
  await choose(fixturePaths[1]);
  await until(`(() => {const node=${query('settings-gradient-avatar-image')};return !!node &&
    (node.tagName==='IMG'?node:node.querySelector('img'))?.src !== ${JSON.stringify(previous)};})()`, 'replacement photo');
  const second = await image('settings-gradient-avatar-image');
  assert.notEqual(second, first); assert.equal(downloads, 0); assert.equal(uploads, 2);
  const replaced = await entries();
  assert.equal(replaced.length, 1); assert.ok(replaced[0].source.endsWith('/photo-2.png'));
  assert.equal(replaced[0].size, fixtureBytes[1].length);
  console.log('Updating photo replaced the old local cache, still without a download');
  await evaluate(`caches.delete('ather-profile-photos-v1')`);
  await navigate(); await image('settings-gradient-avatar-image');
  assert.equal(downloads, 1);
  await navigate(); await image('settings-gradient-avatar-image');
  assert.equal(downloads, 1);
  console.log('Deleted cache recovered with one backend image download, then stayed local');
  await evaluate(`(async () => {const bucket=await caches.open('ather-profile-photos-v1'),key=(await bucket.keys())[0],
    old=await bucket.match(key);await bucket.put(key,new Response('corrupted image',{headers:old.headers}));})()`);
  await navigate(); await image('settings-gradient-avatar-image');
  assert.equal(downloads, 2);
  console.log('Corrupt local image automatically recovered once from backend');
  failNextUpload = true;
  const before = await image('settings-gradient-avatar-image');
  await choose(fixturePaths[0]);
  await until(`document.body.innerText.includes('Could not update profile photo')`, 'upload error');
  assert.equal(await image('settings-gradient-avatar-image'), before);
  assert.equal((await entries())[0].size, fixtureBytes[1].length);
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile('generated-artifacts/profile-photo-browser/settings.png', Buffer.from(screenshot.data, 'base64'));
  console.log('Rejected upload preserved the previous local photo');
  imageUrl = null;
  await navigate(); await wait('settings-gradient-avatar');
  await until(`(async () => (await (await caches.open('ather-profile-photos-v1')).keys()).length===0)()`, 'removed-photo cleanup');
  assert.equal((await entries()).length, 0);
  console.log('Backend photo removal cleared the owned local photo');
  assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
} finally { ws.close(); }
