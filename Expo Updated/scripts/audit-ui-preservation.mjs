import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const target = 'AtherChain-2.0/Expo Updated/';
const changed = execFileSync('git', ['diff', '--name-only', '--', target], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const printer = ts.createPrinter({ removeComments: true });
function styles(text, filename) {
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const values = [];
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(source) === 'style' && node.initializer)
      values.push(printer.printNode(ts.EmitHint.Unspecified, node.initializer, source));
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'StyleSheet.create')
      values.push(printer.printNode(ts.EmitHint.Unspecified, node, source));
    ts.forEachChild(node, visit);
  }
  visit(source);
  return values.sort();
}
let checked = 0;
for (const file of changed.filter(file => file.endsWith('.tsx'))) {
  const before = execFileSync('git', ['show', `HEAD:${file}`], { cwd: root, encoding: 'utf8' });
  const after = fs.readFileSync(path.join(root, file), 'utf8');
  assert.deepEqual(styles(after, file), styles(before, file), `Presentation styles changed: ${file}`);
  checked++;
}
assert.equal(changed.some(file => /\/constants\/|\/assets\//.test(file)), false, 'Theme or visual assets changed');
console.log(`Presentation audit passed: ${checked} changed TSX files retain every original style expression and StyleSheet definition.`);
