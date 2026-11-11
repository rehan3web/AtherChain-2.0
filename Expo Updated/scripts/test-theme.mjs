import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
function load(relative, dependencies = {}) {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
  const exports = {};
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: false },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in dependencies, `Unexpected import: ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const colors = load('../constants/colors.ts').default;

function harness({ saved = null, system = 'light', readError = false, writeError = false } = {}) {
  const hooks = [];
  let cursor = 0;
  let effects = [];
  let writes = 0;
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    createElement: (_, props) => props,
    useState: initial => {
      const i = cursor++;
      if (!(i in hooks)) hooks[i] = initial;
      return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }];
    },
    useRef: initial => {
      const i = cursor++;
      hooks[i] ??= { current: initial };
      return hooks[i];
    },
    useEffect: (effect, dependencies) => {
      const i = cursor++;
      if (!hooks[i] || dependencies.some((value, n) => value !== hooks[i][n])) {
        hooks[i] = dependencies;
        effects.push(effect);
      }
    },
  };
  react.default = react;
  const storage = {
    getItem: async () => { if (readError) throw Error('read failed'); return saved; },
    setItem: async (_, value) => {
      writes++;
      if (writeError) throw Error('write failed');
      saved = value;
    },
  };
  const module = load('../hooks/useTheme.tsx', {
    react,
    'react-native': { Platform: { OS: 'ios' }, useColorScheme: () => system },
    '@react-native-async-storage/async-storage': { default: storage },
    '@/constants/colors': { default: colors },
  });
  const render = () => {
    cursor = 0;
    const tree = module.ThemeProvider({ children: null });
    const pending = effects;
    effects = [];
    pending.forEach(effect => effect());
    return tree.value;
  };
  return { render, readSaved: () => saved, writes: () => writes, setSystem: next => { system = next; } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('restores a saved dark preference before showing the app', async () => {
  const app = harness({ saved: 'dark' });
  assert.equal(app.render().ready, false);
  await settle();
  const value = app.render();
  assert.equal(value.ready, true);
  assert.equal(value.scheme, 'dark');
  assert.equal(app.writes(), 0);
});

test('uses system appearance until the user chooses and persists across a fresh mount', async () => {
  const app = harness({ system: 'dark' });
  app.render();
  await settle();
  assert.equal(app.render().scheme, 'dark');
  await app.render().toggleTheme();
  assert.equal(app.render().scheme, 'light');
  assert.equal(app.readSaved(), 'light');
  const reopened = harness({ saved: app.readSaved(), system: 'dark' });
  reopened.render();
  await settle();
  assert.equal(reopened.render().scheme, 'light');
});

test('rapid repeated toggles cannot race writes; a later toggle works', async () => {
  const app = harness();
  app.render();
  await settle();
  const value = app.render();
  const first = value.toggleTheme();
  await value.toggleTheme();
  assert.equal(app.writes(), 1);
  assert.equal(app.render().scheme, 'dark');
  await first;
  await app.render().toggleTheme();
  assert.equal(app.render().scheme, 'light');
  assert.equal(app.writes(), 2);
});

test('storage failures are visible and a failed save rolls back the theme', async () => {
  const app = harness({ writeError: true });
  app.render();
  await settle();
  await app.render().toggleTheme();
  assert.equal(app.render().scheme, 'light');
  assert.match(app.render().error, /Could not save/);
  assert.equal(app.readSaved(), null);
  assert.equal(app.render().saving, false);
  const unreadable = harness({ readError: true });
  unreadable.render();
  await settle();
  assert.equal(unreadable.render().ready, true);
  assert.match(unreadable.render().error, /Could not load/);
});

test('invalid saved preferences are not silently treated as valid', async () => {
  const app = harness({ saved: 'invalid' });
  app.render();
  await settle();
  assert.match(app.render().error, /Saved theme could not be read/);
  assert.equal(app.writes(), 0);
});

test('all appearance options persist, and System follows live device changes', async () => {
  const app = harness({ saved: 'light', system: 'dark' });
  app.render();
  await settle();
  await app.render().setTheme('dark');
  assert.equal(app.render().scheme, 'dark');
  assert.equal(app.readSaved(), 'dark');
  await app.render().setTheme('system');
  assert.equal(app.render().preference, 'system');
  assert.equal(app.readSaved(), 'system');
  assert.equal(app.render().scheme, 'dark');
  app.setSystem('light');
  assert.equal(app.render().scheme, 'light');
  const reopened = harness({ saved: app.readSaved(), system: 'dark' });
  reopened.render();
  await settle();
  assert.equal(reopened.render().preference, 'system');
  assert.equal(reopened.render().scheme, 'dark');
  await app.render().setTheme('light');
  app.setSystem('dark');
  assert.equal(app.render().scheme, 'light');
});

test('failed appearance selection restores both mode and system following', async () => {
  const app = harness({ saved: 'system', system: 'dark', writeError: true });
  app.render();
  await settle();
  await app.render().setTheme('light');
  assert.equal(app.render().preference, 'system');
  assert.equal(app.render().scheme, 'dark');
  assert.match(app.render().error, /Could not save/);
  app.setSystem('light');
  assert.equal(app.render().scheme, 'light');
});

function luminance(hex) {
  const values = hex.slice(1).match(/../g).map(value => {
    const s = parseInt(value, 16) / 255;
    return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
  });
  return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
}
const contrast = (a, b) => {
  const l = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (l[0] + .05) / (l[1] + .05);
};
test('both palettes cover all surfaces, buttons and readable QR codes', () => {
  assert.deepEqual(Object.keys(colors.light).sort(), Object.keys(colors.dark).sort());
  for (const theme of [colors.light, colors.dark]) {
    for (const surface of ['background', 'walletSheet', 'walletField', 'miningPage']) {
      assert.ok(contrast(theme.walletInk, theme[surface]) >= 4.5, `Ink on ${surface}`);
      assert.ok(contrast(theme.walletSubtle, theme[surface]) >= 4.5, `Secondary ink on ${surface}`);
    }
    assert.ok(contrast(theme.walletOnInk, theme.walletInk) >= 4.5);
    assert.ok(contrast(theme.walletOnInk, theme.walletDarkTop) >= 4.5);
    assert.ok(contrast(theme.walletOnInk, theme.walletDarkBottom) >= 4.5);
    assert.ok(contrast(theme.walletQRInk, theme.walletQRBackground) >= 7);
  }
  assert.equal(colors.light.dashboardBalance, '#18181B');
  assert.equal(colors.dark.walletDarkTop, '#ffffff');
  assert.equal(colors.dark.walletDarkBottom, '#ffffff');
});
