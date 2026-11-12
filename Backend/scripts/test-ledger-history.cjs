const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./ledger-fixtures.cjs');
const key = 'history-fixture-key-0001';
async function payment(h) {
    return h.load('src/services/wallet.ts').WalletService.transfer('sender', 'receiver', 20, 'send', 'ATH', key);
}

test('MongoDB outage cannot fail or repeat a committed transfer', async () => {
    const h = harness(); h.mongo.connected = false;
    const first = await payment(h);
    await h.load('src/services/ledgerHistory.ts').flushLedgerHistory();
    assert.equal(first.success, true); assert.equal(first.historyPending, true);
    assert.equal(h.mongo.transactions.size, 0);
    assert.equal(h.db.state.operations[0].delivered_at, null);
    const replay = await payment(h);
    assert.equal(replay.hash, first.hash);
    assert.equal(h.db.state.wallets.sender.balance_ath, '80.00000000');
    h.mongo.connected = true;
    await h.load('src/services/ledgerHistory.ts').flushLedgerHistory();
    assert.equal(h.mongo.transactions.size, 2);
    assert.equal(h.db.state.operations[0].events.length, 0);
});
test('partial MongoDB batch delivery retries without duplicate history entries', async () => {
    const h = harness(); await payment(h); h.mongo.failAt = 2;
    await h.load('src/services/ledgerHistory.ts').flushLedgerHistory();
    assert.equal(h.mongo.transactions.size, 1);
    assert.equal(h.db.state.operations[0].delivered_at, null);
    assert.equal(h.db.state.operations[0].events.length, 2);
    assert.equal(h.db.state.wallets.sender.balance_ath, '80.00000000');
    h.retryNow();
    await h.load('src/services/ledgerHistory.ts').flushLedgerHistory();
    assert.equal(h.mongo.transactions.size, 2);
    assert.equal(h.db.state.operations[0].delivered_at, 'delivered');
    assert.equal(h.db.state.operations[0].events.length, 0);
    const replay = await payment(h);
    assert.equal(replay.historyPending, false);
});
test('mining history failure leaves a durable intent, not a second credit', async () => {
    const h = harness(); const service = h.load('src/services/miningService.ts').MiningService;
    await service.execute('sender', key); h.mongo.failAt = 1;
    await h.load('src/services/ledgerHistory.ts').flushLedgerHistory();
    await service.execute('sender', key);
    assert.equal(h.db.state.users.sender.at_balance, '102.00000000');
    h.retryNow(); await h.load('src/services/ledgerHistory.ts').flushLedgerHistory();
    assert.equal(h.mongo.transactions.size, 1); assert.equal(h.mongo.mining.size, 1);
});
test('swap success receipt does not depend on MongoDB availability', async () => {
    const h = harness(); h.mongo.connected = false;
    const first = await h.load('src/services/swapService.ts').SwapService.swapATtoATH('sender', 10, key);
    assert.equal(first.value.success, true);
    assert.equal(first.value.receipt.toAmount, 20);
    assert.equal(first.historyPending, true);
    h.mongo.connected = true; await h.load('src/services/ledgerHistory.ts').flushLedgerHistory();
    const transaction = [...h.mongo.transactions.values()][0];
    assert.equal(transaction._id, first.value.txId);
    assert.equal(transaction.txHash, first.value.hash);
});
test('delivery does not recreate history for a deleted recipient account', async () => {
    const h = harness(); await payment(h);
    delete h.db.state.users.receiver; delete h.db.state.wallets.receiver;
    await h.load('src/services/ledgerHistory.ts').flushLedgerHistory();
    assert.equal(h.mongo.transactions.size, 1);
    assert.equal([...h.mongo.transactions.values()][0].userId, 'sender');
    assert.ok(h.db.calls.some(call => call.sql.includes('FOR KEY SHARE')));
});
