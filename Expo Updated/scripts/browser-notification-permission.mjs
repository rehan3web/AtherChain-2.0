// Native OS behavior is tested separately. This renders the actual public
// pre-onboarding screen in an isolated browser root with a denied-state fixture.
// It does not change app routing, authentication, or real permission state.
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
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const query = id => `document.querySelector('[data-testid="${id}"]')`;
const wait = async id => {
  for (let n = 0; n < 160; n++) {
    if (await evaluate(`!!${query(id)}`)) return;
    await sleep(200);
  }
  throw Error(`Missing ${id}`);
};
const cleanup = `if(window.__permissionPreviewRoot){window.__permissionPreviewRoot.unmount();delete window.__permissionPreviewRoot;}
document.getElementById('permission-visual-fixture')?.remove();delete window.__permissionSettingsClicks;`;
let previousTheme = null, backedUp = false;
try {
  await send('Emulation.setDeviceMetricsOverride', { width: 393, height: 851, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${base}/` });
  await wait('welcome-screen');
  assert.equal(await evaluate(`!!${query('notification-permission-screen')}`), false, 'Web must not be gated');
  console.log('PASS: fresh web entry reaches onboarding without a phone notification gate');
  previousTheme = await evaluate(`localStorage.getItem('atherchain-theme-v1')`);
  backedUp = true;
  for (const theme of ['light', 'dark']) {
    await evaluate(cleanup);
    await evaluate(`localStorage.setItem('atherchain-theme-v1',${JSON.stringify(theme)})`);
    await evaluate(`(() => {
      const modules=Array.from(__r.getModules().entries());
      const requireModule=suffix=>{
        const entry=modules.find(([,module])=>module.verboseName?.endsWith(suffix));
        if(!entry)throw new Error('Missing fixture module: '+suffix);
        return __r(entry[0]);
      };
      const React=requireModule('node_modules/react/index.js');
      const {createRoot}=requireModule('node_modules/react-dom/client.js');
      const {SafeAreaProvider}=requireModule('react-native-safe-area-context/lib/module/index.js');
      const {ThemeProvider}=requireModule('hooks/useTheme.tsx');
      const {NotificationPermissionScreen}=requireModule('components/notification-permission/NotificationPermissionScreen.tsx');
      const node=document.createElement('div');node.id='permission-visual-fixture';
      Object.assign(node.style,{position:'fixed',inset:'0',zIndex:'999999',display:'flex',flexDirection:'column'});
      document.body.appendChild(node);window.__permissionSettingsClicks=0;
      const root=createRoot(node);window.__permissionPreviewRoot=root;
      root.render(React.createElement(SafeAreaProvider,{initialMetrics:{frame:{x:0,y:0,width:innerWidth,height:innerHeight},insets:{top:0,right:0,bottom:0,left:0}}},
        React.createElement(ThemeProvider,null,React.createElement(NotificationPermissionScreen,{
          state:{phase:'blocked',busy:false,error:null},
          onAllow:()=>{window.__permissionSettingsClicks++;},onRetry:()=>{}
        }))));
    })()`);
    await wait('notification-permission-screen');
    await sleep(500);
    assert.equal(await evaluate(`${query('notification-permission-allow')}.innerText`), 'Allow Notifications');
    await evaluate(`${query('notification-permission-allow')}.click()`);
    assert.equal(await evaluate('window.__permissionSettingsClicks'), 1);
    for (const [width, height] of [[320, 568], [393, 851], [430, 932], [768, 1024], [844, 390]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await sleep(200);
      const bounds = await evaluate(`(() => {
        const button=${query('notification-permission-allow')}.getBoundingClientRect();
        const page=${query('notification-permission-screen')};
        return {left:button.left,right:button.right,bottom:button.bottom,height:button.height,overflow:page.scrollWidth-page.clientWidth};
      })()`);
      assert.ok(bounds.left >= 0 && bounds.right <= width + 1);
      assert.ok(bounds.bottom <= height && bounds.height >= 44, 'Bottom action must remain reachable');
      assert.ok(bounds.overflow <= 1, 'No horizontal overflow');
    }
    await send('Emulation.setDeviceMetricsOverride', { width: 393, height: 851, deviceScaleFactor: 1, mobile: false });
    await sleep(500);
    const image = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    await fs.mkdir('generated-artifacts', { recursive: true });
    await fs.writeFile(`generated-artifacts/notification-permission-${theme}.jpg`, Buffer.from(image.data, 'base64'));
  }
  console.log('PASS: actual permission screen, vector art and button wiring in both themes at five responsive sizes');
} finally {
  await evaluate(cleanup);
  if (backedUp) await evaluate(previousTheme === null ? `localStorage.removeItem('atherchain-theme-v1')` : `localStorage.setItem('atherchain-theme-v1',${JSON.stringify(previousTheme)})`);
  ws.close();
}
