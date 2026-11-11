import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const removed = [
  'app/networks.tsx', 'app/network-wallet.tsx', 'app/add-network.tsx',
  'components/wallet/NetworkScreen.tsx',
];

test('alternate-network pages and navigation registrations are removed', () => {
  for (const file of removed) assert.equal(fs.existsSync(new URL(file, root)), false, `${file} must not remain`);
  const layout = read('app/_layout.tsx');
  for (const route of ['networks', 'network-wallet', 'add-network']) assert.ok(!layout.includes(`name="${route}"`));
});

test('alternate-network wallets, custom configuration code and unused logos are removed', () => {
  for (const directory of ['components/network-wallet/', 'assets/images/networks/']) {
    const path = new URL(directory, root);
    assert.ok(!fs.existsSync(path) || fs.readdirSync(path).length === 0, `${directory} must contain no removed feature files`);
  }
  const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    return entry.isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
  for (const path of [...walk(new URL('app/', root)), ...walk(new URL('components/', root))]) {
    assert.doesNotMatch(fs.readFileSync(path, 'utf8'), /components\/network-wallet|\/add-network|\/network-wallet|['"]\/networks['"]|wallet-network/, path.pathname);
  }
});

test('the complete AtherChain wallet retains Send, Receive, Swap, settings and receipts', () => {
  const card = read('components/wallet/MoneyCard.tsx');
  for (const id of ['wallet-send', 'wallet-receive', 'wallet-activity', 'wallet-settings']) assert.ok(card.includes(`testID="${id}"`));
  for (const component of ['TransferSheet', 'ReceiveSheet', 'SwapSheet', 'SettingsSheet', 'ActivityList', 'SendReceipt', 'SwapReceipt']) assert.ok(card.includes(`<${component}`));
  assert.doesNotMatch(card, /Open networks|wallet-network|name="globe"/);
});
