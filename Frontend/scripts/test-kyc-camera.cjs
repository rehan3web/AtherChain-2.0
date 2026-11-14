// Render the actual React camera component with simulated media devices.
// These checks do not access a physical camera or a configured API.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const frontend = path.resolve(__dirname, '..');
const requireApp = createRequire(path.join(frontend, 'package.json'));
const ts = requireApp('typescript');
const React = requireApp('react');
const { act } = React;
const { createRoot } = requireApp('react-dom/client');
const frame = 'data:image/jpeg;base64,/9j/2Q==';
let window, LivePhoto, getMedia, cameraCalls;

function compile(file, dependencies) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(frontend, file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX }
    }).outputText, {
        exports, console, window, document: window.document, navigator: window.navigator,
        Error, DOMException: window.DOMException, setTimeout, clearTimeout,
        require(name) {
            if (name in dependencies) return dependencies[name];
            if (name.startsWith('react')) return requireApp(name);
            throw new Error(`Unexpected dependency: ${name}`);
        }
    });
    return exports;
}

test.before(async () => {
    const { Window } = await import(requireApp.resolve('happy-dom'));
    window = new Window({ url: 'https://kyc.fixture' });
    global.window = window;
    global.document = window.document;
    global.HTMLElement = window.HTMLElement;
    global.Node = window.Node;
    global.IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window.navigator, 'mediaDevices', {
        configurable: true, value: { getUserMedia: (...args) => { cameraCalls++; return getMedia(...args); } }
    });
    window.HTMLMediaElement.prototype.play = async () => {};
    // The DOM emulator insists on its own MediaStream class. Real capture is
    // intentionally replaced by a controllable fixture, including its stop().
    const sources = new WeakMap();
    Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
        configurable: true,
        get() { return sources.get(this) ?? null; },
        set(value) { sources.set(this, value); }
    });
    window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
    window.HTMLCanvasElement.prototype.toDataURL = () => frame;
    const photo = compile('src/lib/kycPhoto.ts', {});
    const Icon = () => React.createElement('span');
    LivePhoto = compile('src/app/dashboard/kyc/components/LivePhoto.tsx', {
        '@/lib/kycPhoto': photo,
        'lucide-react': { Camera: Icon, Loader2: Icon, RefreshCw: Icon },
        '@/components/ui/button': { Button: ({ children, variant, ...props }) => React.createElement('button', props, children) }
    }).LivePhoto;
});
test.beforeEach(() => {
    cameraCalls = 0;
    Object.defineProperty(window.document, 'hidden', { configurable: true, value: false });
});
test.after(() => window.happyDOM.abort());

async function render(onCaptured = async () => {}) {
    let stopped = 0;
    const stream = { getTracks: () => [{ stop() { stopped++; } }] };
    getMedia = async constraints => {
        assert.equal(constraints.video.facingMode, 'user');
        assert.equal(constraints.audio, false);
        return stream;
    };
    const element = window.document.createElement('div');
    window.document.body.append(element);
    const root = createRoot(element);
    await act(async () => root.render(React.createElement(LivePhoto, { isSubmitting: false, onCaptured })));
    const view = {
        element, root, stream, stopped: () => stopped,
        button(text) {
            const match = [...element.querySelectorAll('button')].find(button => button.textContent.includes(text));
            assert.ok(match, `Button missing: ${text}. Rendered: ${element.textContent}`);
            return match;
        },
        async click(text) { await act(async () => view.button(text).dispatchEvent(new window.MouseEvent('click', { bubbles: true }))); },
        async ready() {
            const video = element.querySelector('video');
            Object.defineProperties(video, {
                readyState: { configurable: true, value: 2 },
                videoWidth: { configurable: true, value: 720 },
                videoHeight: { configurable: true, value: 960 }
            });
            await act(async () => video.dispatchEvent(new window.Event('loadeddata', { bubbles: true })));
        },
        async close() { await act(async () => root.unmount()); element.remove(); }
    };
    return view;
}

test('one explicit capture submits one photo once and releases the camera', async () => {
    const submissions = [];
    const view = await render(async photo => submissions.push(photo));
    assert.equal(cameraCalls, 0); // No automatic camera permission or capture.
    await view.click('Enable front camera');
    await view.ready();
    const capture = view.button('Take photo');
    await act(async () => {
        capture.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        capture.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    assert.deepEqual(submissions, [frame]);
    assert.equal(view.stopped(), 1);
    assert.ok(view.element.querySelector('img'));
    assert.match(view.element.textContent, /not verified biometric liveness/);
    await view.close();
});

test('a failed submission preserves the photo for retry without taking another image', async () => {
    let attempts = 0;
    const view = await render(async captured => {
        assert.equal(captured, frame);
        if (++attempts === 1) throw new Error('Upload failed');
    });
    await view.click('Enable front camera');
    await view.ready();
    await view.click('Take photo');
    assert.match(view.element.querySelector('[role="alert"]').textContent, /Upload failed/);
    await view.click('Retry submission');
    assert.equal(attempts, 2);
    assert.equal(cameraCalls, 1);
    await view.close();
});

test('camera denial is actionable and does not submit an application', async () => {
    let submissions = 0;
    const view = await render(async () => submissions++);
    getMedia = async () => { throw new window.DOMException('Denied', 'NotAllowedError'); };
    await view.click('Enable front camera');
    assert.match(view.element.querySelector('[role="alert"]').textContent, /Enable camera access/);
    assert.equal(view.button('Enable front camera').disabled, false);
    assert.equal(submissions, 0);
    await view.close();
});

test('hiding the page releases the camera and requires an explicit restart', async () => {
    const view = await render();
    await view.click('Enable front camera');
    await view.ready();
    Object.defineProperty(window.document, 'hidden', { configurable: true, value: true });
    await act(async () => window.document.dispatchEvent(new window.Event('visibilitychange')));
    assert.equal(view.stopped(), 1);
    assert.match(view.element.textContent, /Camera paused/);
    await view.close();
});

test('a camera permission result arriving after navigation cannot leave the camera running', async () => {
    const view = await render();
    let resolve;
    getMedia = () => new Promise(done => { resolve = done; });
    await view.click('Enable front camera');
    await view.close();
    await act(async () => { resolve(view.stream); await Promise.resolve(); });
    assert.equal(view.stopped(), 1);
});
