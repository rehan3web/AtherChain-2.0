import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../components/wallet/TransferSheet.tsx', import.meta.url), 'utf8');
const expression = source.match(/const label = ([\s\S]*?);\n/)?.[1];
assert.ok(expression, 'Transfer button label must exist');
const label = overrides => vm.runInNewContext(expression, {
  isSend: true, pending: false, target: null, cents: 0, over: false,
  m: { full: value => `ATH ${value.toFixed(2)}` }, ...overrides,
});

test('Send stays fixed for empty, invalid, entered and pending recipient/amount states', () => {
  for (const target of [null, 'person@example.com', '@sample_user', '0x1234567890']) {
    for (const cents of [0, 200, 10000000]) {
      for (const pending of [false, true]) {
        for (const over of [false, true]) assert.equal(label({ target, cents, pending, over }), 'Send');
      }
    }
  }
});

test('Request labels remain unchanged', () => {
  assert.equal(label({ isSend: false }), 'Choose a recipient');
  assert.equal(label({ isSend: false, pending: true }), 'Requesting…');
  assert.equal(label({ isSend: false, target: 'Alex' }), 'Enter an amount');
  assert.equal(label({ isSend: false, target: 'Alex', cents: 200 }), 'Request ATH 2.00 from Alex');
});

test('the fixed label is used for both button text and accessibility without changing validation', () => {
  assert.match(source, /accessibilityLabel=\{label\}/);
  assert.match(source, /disabled=\{!valid \|\| pending\}/);
  assert.match(source, /\{label\}\s*<\/Text>/);
});
