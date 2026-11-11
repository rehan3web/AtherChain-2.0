import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(new URL('../utils/clipboard.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
function harness({ platform = 'web', native = true, modern = true, legacy = true } = {}) {
  const exports = {};
  let removed = false, fallbackCalls = 0;
  const document = {
    activeElement: null,
    createElement: () => ({ style: {}, setAttribute() {}, select() {}, remove() { removed = true; } }),
    body: { appendChild() {} },
    execCommand: () => { fallbackCalls++; return legacy; },
  };
  vm.runInNewContext(code, {
    exports, HTMLElement: class {}, document,
    navigator: { clipboard: modern == null ? undefined : { writeText: async () => { if (!modern) throw new Error('Denied'); } } },
    require: name => name === 'react-native' ? { Platform: { OS: platform } } : { setStringAsync: async () => native },
  });
  return { copy: exports.copyText, removed: () => removed, fallbackCalls: () => fallbackCalls };
}
test('native copies must report success', async () => { await harness({ platform: 'ios' }).copy('Reference'); });
test('native false results do not produce a success notification', async () => { await assert.rejects(harness({ platform: 'android', native: false }).copy('Reference')); });
test('modern web clipboard succeeds without a fallback', async () => {
  const h = harness(); await h.copy('Reference'); assert.equal(h.fallbackCalls(), 0);
});
test('a browser-denied write can use a successful legacy copy', async () => {
  const h = harness({ modern: false }); await h.copy('Reference'); assert.equal(h.fallbackCalls(), 1); assert.ok(h.removed());
});
test('a failed legacy result rejects and removes its temporary field', async () => {
  const h = harness({ modern: false, legacy: false }); await assert.rejects(h.copy('Reference')); assert.ok(h.removed());
});
test('a browser without the clipboard API still validates its fallback result', async () => {
  await assert.rejects(harness({ modern: null, legacy: false }).copy('Reference'));
});
