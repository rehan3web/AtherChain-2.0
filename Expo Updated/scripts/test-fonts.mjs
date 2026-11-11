import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const families = ['DMSans_400Regular', 'DMSans_500Medium', 'DMSans_600SemiBold', 'DMSans_700Bold'];

test('all app font references use registered DM Sans names, not cached aliases', () => {
  const layout = fs.readFileSync(new URL('app/_layout.tsx', root), 'utf8');
  assert.match(layout, /from '@expo-google-fonts\/dm-sans'/);
  for (const family of families) assert.match(layout, new RegExp(`\\b${family},`));
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : /\.tsx?$/.test(entry.name) ? [full] : [];
  });
  for (const folder of ['app', 'components']) {
    for (const file of walk(fileURLToPath(new URL(folder, root)))) {
      const source = fs.readFileSync(file, 'utf8');
      assert.doesNotMatch(source, /Inter_\d|Geist_\d/, file);
      for (const [, family] of source.matchAll(/['"](DMSans_\w+)['"]/g)) {
        assert.ok(families.includes(family), `${file}: unregistered ${family}`);
      }
    }
  }
});
