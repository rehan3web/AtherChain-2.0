import test from 'node:test';
import assert from 'node:assert/strict';
import { load, hooks, byId } from './auth-test-utils.mjs';

const recipient = load('../components/wallet/recipient.ts');
const transactions = load('../services/transactions.ts', {
  './api': { transactionApi: {} }, '@/components/wallet/recipient': recipient,
});
const { transactionReceipt } = load('../components/wallet/transactionReceipt.ts');
const labels = { username: 'Username', email: 'Email', address: 'Address' };
const senderAddress = `ATH_${'a'.repeat(40)}`, receiverAddress = `ATH_${'b'.repeat(40)}`;
const incoming = { id: 'receiver-history', timestamp: '2026-11-13T12:00:00Z',
  txHash: 'ATH_TX_FIXTURE_RCV', type: 'receive', amount: '2.50000000', status: 'completed',
  fromAddress: senderAddress, toAddress: receiverAddress };
const senderId = '00000000-0000-4000-8000-000000000001';
const source = { ...incoming, id: 'sender-history', txHash: 'ATH_TX_FIXTURE', type: 'send', userId: senderId };
const usernameMetadata = { recipient: { method: 'username', value: '@receiver' },
  sender: { method: 'username', value: '@original_sender' } };

function receiptTree(receipt) {
  const h = hooks();
  const { SendReceipt } = load('../components/wallet/SendReceipt.tsx', {
    react: h.react, 'react-native': { ...h.native, Platform: { OS: 'web' } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@expo/vector-icons': { Feather: 'Feather' }, '@/utils/clipboard': { copyText() {} },
    '@/hooks/useColors': { useColors: () => ({}) }, './ConfirmedIcon': { ConfirmedIcon: 'ConfirmedIcon' },
    './SendConfirmation': { SendDetail: 'SendDetail', SEND_METHOD_LABELS: labels },
    './format': { formatReceiptAmount: (_money, amount) => `${amount} ATH` },
    '@/components/toast/ToastProvider': { ToastSurface: 'ToastSurface', useToast: () => ({ showToast() {} }) },
    '@/hooks/useReceiptImage': { useReceiptImage: () => ({ receiptRef: {}, sharing: false, shareImage() {} }) },
  });
  return h.render(() => SendReceipt({ receipt, money: {}, onClose() {} }));
}
for (const [method, value] of [['username', '@receiver'], ['email', 'receiver@example.test'], ['address', receiverAddress]]) {
  test(`receiver receipt retains original ${method} method and separates sender from destination in both history screens`, () => {
    const sender = method === 'address' ? { method: 'address', value: senderAddress } : usernameMetadata.sender;
    const item = { ...incoming, metadata: { recipient: { method, value }, sender } };
    const activity = transactions.backendReceipt(item);
    const wallet = transactionReceipt(transactions.walletTransaction(item), 'en-US');
    for (const receipt of [activity, wallet]) {
      assert.equal(receipt.direction, 'received');
      assert.equal(receipt.recipient.value, sender.value);
      assert.equal(receipt.receivedRecipient.method, method);
      assert.equal(receipt.receivedRecipient.value, value);
      const tree = receiptTree(receipt);
      const via = byId(tree, 'wallet-send-receipt-method');
      assert.equal(via.props.label, 'Received via'); assert.equal(via.props.value, labels[method]);
      assert.equal(byId(tree, 'wallet-send-receipt-counterparty').props.label, 'Sender');
      assert.equal(byId(tree, 'wallet-send-receipt-counterparty').props.value, sender.value);
      assert.equal(byId(tree, 'wallet-send-receipt-receiver').props.value, value);
    }
  });
}
test('sender history remains unchanged and does not add a duplicate Receiver row', () => {
  const receipt = transactions.backendReceipt({ ...source, metadata: usernameMetadata });
  const tree = receiptTree(receipt);
  assert.equal(byId(tree, 'wallet-send-receipt-method').props.value, 'Username');
  assert.equal(byId(tree, 'wallet-send-receipt-method').props.label, 'Send via');
  assert.equal(byId(tree, 'wallet-send-receipt-counterparty').props.value, '@receiver');
  assert.equal(byId(tree, 'wallet-send-receipt-receiver'), undefined);
});
test('legacy unknown-method receipts remain address-based, never guessed from a current username', () => {
  const receipt = transactions.backendReceipt({ ...incoming, metadata: { sender: usernameMetadata.sender } });
  assert.equal(receipt.recipient.value, senderAddress);
  assert.equal(receipt.receivedRecipient, undefined);
  assert.equal(byId(receiptTree(receipt), 'wallet-send-receipt-method').props.value, 'Address');
});

function recoveryFixture(sources, usernames = [{ id: senderId, username: 'current_sender' }]) {
  const calls = [];
  const { receivedTransferMetadata } = load('../../Backend/src/services/receivedTransferMetadata.ts', {
    '../db/postgres': { query: async (sql, params) => {
      assert.match(sql, /^SELECT id,username FROM users/);
      calls.push({ sql, params }); return { rows: usernames };
    } },
    '../models/Transaction': { find: async filter => {
      calls.push({ filter });
      return sources.filter(row => row.type === filter.type && filter.txHash.$in.includes(row.txHash));
    } },
  });
  return { recover: receivedTransferMetadata, calls };
}
test('new receiver records already contain both identities and require no recovery queries', async () => {
  const f = recoveryFixture([]);
  assert.equal((await f.recover([{ ...incoming, metadata: usernameMetadata }])).size, 0);
  assert.equal(f.calls.length, 0);
});
test('legacy receive records recover original method from their exact sender record, not current recipient data', async () => {
  const f = recoveryFixture([{ ...source, metadata: { recipient: usernameMetadata.recipient } }]);
  const recovered = await f.recover([incoming]);
  const metadata = recovered.get(incoming.txHash);
  assert.equal(metadata.recipient.value, '@receiver');
  assert.equal(metadata.sender.value, '@current_sender');
  const receipt = transactions.backendReceipt({ ...incoming, metadata });
  assert.equal(receipt.receivedRecipient.method, 'username');
  assert.equal(receipt.recipient.value, '@current_sender');
  assert.equal(f.calls.length, 2);
});
test('legacy recovery prefers saved sender snapshots and needs no profile query', async () => {
  const f = recoveryFixture([{ ...source, metadata: usernameMetadata }]);
  const result = await f.recover([incoming]);
  assert.equal(result.get(incoming.txHash).sender.value, '@original_sender');
  assert.equal(f.calls.length, 1);
});
test('legacy address transfers do not look up or expose usernames or emails', async () => {
  const f = recoveryFixture([{ ...source, metadata: { recipient: { method: 'address', value: receiverAddress } } }]);
  const result = await f.recover([incoming]);
  assert.equal(result.get(incoming.txHash).sender.value, senderAddress);
  assert.equal(f.calls.length, 1);
  assert.equal(JSON.stringify(result.get(incoming.txHash)).includes('email'), false);
});
test('old non-UUID sender IDs cannot break history with an invalid PostgreSQL cast', async () => {
  const f = recoveryFixture([{ ...source, userId: 'legacy-object-id',
    metadata: { recipient: usernameMetadata.recipient } }]);
  const result = await f.recover([incoming]);
  assert.equal(result.get(incoming.txHash).recipient.method, 'username');
  assert.equal(result.get(incoming.txHash).sender.value, senderAddress);
  assert.equal(f.calls.length, 1);
});
test('unmatched, non-transfer and missing-original-metadata histories never manufacture a method', async () => {
  for (const badSource of [
    { ...source, fromAddress: 'different-wallet', metadata: usernameMetadata },
    { ...source, toAddress: 'different-wallet', metadata: usernameMetadata },
    { ...source, amount: '100.00000000', metadata: usernameMetadata },
    { ...source, txHash: 'different-hash', metadata: usernameMetadata },
    { ...source }, // A known sender alone cannot establish the originally used method.
  ]) {
    const f = recoveryFixture([badSource]);
    assert.equal((await f.recover([incoming])).size, 0);
  }
  const f = recoveryFixture([source]);
  assert.equal((await f.recover([{ ...incoming, type: 'mining' }, { ...incoming, txHash: 'not-an-internal-pair' }])).size, 0);
  assert.equal(f.calls.length, 0);
});
test('recovery batches legacy receipts into one history query and one public-username query without writes', async () => {
  const second = { ...source, txHash: 'ATH_TX_SECOND', metadata: { recipient: { method: 'email', value: 'receiver@example.test' } } };
  const f = recoveryFixture([{ ...source, metadata: { recipient: usernameMetadata.recipient } }, second]);
  const result = await f.recover([incoming, { ...incoming, txHash: 'ATH_TX_SECOND_RCV' }]);
  assert.equal(result.size, 2); assert.equal(f.calls.length, 2);
  assert.equal(f.calls[1].params[0].length, 1);
  assert.equal(result.get('ATH_TX_SECOND_RCV').recipient.method, 'email');
  assert.equal(result.get('ATH_TX_SECOND_RCV').sender.method, 'username');
});
