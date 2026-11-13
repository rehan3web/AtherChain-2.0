const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./ledger-fixtures.cjs');
const key = 'operation-fixture-key-0001';
const swap = (h, k = key, amount = 10) => h.load('src/services/swapService.ts').SwapService.swapATtoATH('sender', amount, k);
const send = (h, k = key, amount = 20) => h.load('src/services/wallet.ts').WalletService.transfer('sender', 'receiver', amount, 'send', 'ATH', k);
const mine = (h, k = key, boost = false) => h.load('src/services/miningService.ts').MiningService.execute('sender', k, boost);

test('send history persists username, email or address method through delivery and replay', async () => {
    for (const [identifier, method, value] of [
        ['receiver', 'username', '@receiver'],
        ['receiver@example.test', 'email', 'receiver@example.test'],
        ['ATH_RECEIVER', 'address', 'ATH_RECEIVER'],
    ]) {
        const h = harness();
        const service = h.load('src/services/wallet.ts').WalletService;
        const first = await service.transfer('sender', identifier, 2, 'send', 'ATH', key);
        const event = h.db.state.operations[0].events[0].document;
        assert.deepEqual(event.metadata.recipient, { method, value });
        const receiver = h.db.state.operations[0].events[1].document;
        assert.deepEqual(receiver.metadata.recipient, { method, value });
        assert.deepEqual(receiver.metadata.sender, method === 'address'
            ? { method: 'address', value: 'ATH_SENDER' } : { method: 'username', value: '@sender' });
        await h.load('src/services/ledgerHistory.ts').flushLedgerHistory();
        assert.deepEqual([...h.mongo.transactions.values()].find(tx => tx.userId === 'sender').metadata.recipient, { method, value });
        assert.deepEqual([...h.mongo.transactions.values()].find(tx => tx.userId === 'receiver').metadata, receiver.metadata);
        const replay = await service.transfer('sender', identifier, 2, 'send', 'ATH', key);
        assert.equal(first.hash, replay.hash);
        assert.equal(h.db.state.wallets.sender.balance_ath, '98.00000000');
    }
});

test('send debits, credits and stores both history intents in one commit', async () => {
    const h = harness(); const result = await send(h);
    assert.equal(result.success, true);
    assert.equal(h.db.state.wallets.sender.balance_ath, '80.00000000');
    assert.equal(h.db.state.wallets.receiver.balance_ath, '27.00000000');
    assert.equal(h.db.state.operations[0].events.length, 2);
    assert.equal(h.db.state.operations[0].events[1].document.type, 'receive');
    assert.equal(h.mongo.calls, 0);
    assert.equal(new Set(h.db.calls.map(call => call.client)).size, 1);
});
test('swap checks destination credit and persists cooldown with the balances', async () => {
    const h = harness(); const result = await swap(h);
    assert.equal(result.value.success, true);
    assert.equal(result.value.receipt.rate, 2);
    assert.equal(h.db.state.users.sender.at_balance, '90.00000000');
    assert.equal(h.db.state.wallets.sender.balance_ath, '120.00000000');
    assert.ok(Date.parse(h.db.state.users.sender.next_swap_at) > Date.now());
    assert.equal(h.db.state.operations[0].events.length, 1);
});
test('missing destination wallet rolls back AT debit, cooldown and history intent', async () => {
    const h = harness(); delete h.db.state.wallets.sender;
    await assert.rejects(swap(h), /Destination wallet not found/);
    assert.equal(h.db.state.users.sender.at_balance, '100.00000000');
    assert.equal(h.db.state.users.sender.next_swap_at, null);
    assert.equal(h.db.state.operations.length, 0);
    assert.equal(h.mongo.calls, 0);
});
test('failed recipient credit rolls back sender debit and cannot publish completed history', async () => {
    const h = harness(); h.db.failCredit = true;
    await assert.rejects(send(h), /Recipient wallet is unavailable/);
    assert.equal(h.db.state.wallets.sender.balance_ath, '100.00000000');
    assert.equal(h.db.state.operations.length, 0);
    await h.load('src/services/ledgerHistory.ts').flushLedgerHistory();
    assert.equal(h.mongo.transactions.size, 0);
});
test('failure to save the durable delivery record rolls back every balance change', async () => {
    for (const operation of [send, swap, mine]) {
        const h = harness(); h.db.failInsert = true;
        await assert.rejects(operation(h), /rolled back; no funds changed/);
        assert.equal(h.db.state.users.sender.at_balance, '100.00000000');
        assert.equal(h.db.state.wallets.sender.balance_ath, '100.00000000');
        assert.equal(h.db.state.wallets.receiver.balance_ath, '7.00000000');
        assert.equal(h.db.state.operations.length, 0);
        assert.equal(h.mongo.calls, 0);
    }
});
test('insufficient funds never produce a completed intent', async () => {
    for (const operation of [h => send(h, key, 200), h => swap(h, key, 200)]) {
        const h = harness(); await assert.rejects(operation(h), /Insufficient/);
        assert.equal(h.db.state.operations.length, 0);
    }
});
test('retrying the same operation returns the same receipt without a second debit', async () => {
    for (const operation of [send, swap, mine]) {
        const h = harness(); const first = await operation(h); const balances = structuredClone(h.db.state);
        const repeated = await operation(h);
        assert.equal(repeated.replayed, true);
        assert.deepEqual(h.db.state, balances);
        if (first.value?.hash) assert.equal(first.value.hash, repeated.value.hash);
        if (first.hash) assert.equal(first.hash, repeated.hash);
        assert.equal(h.db.state.operations.length, 1);
    }
});
test('two concurrent retries serialize and debit exactly once', async () => {
    const h = harness(); const results = await Promise.all([send(h), send(h)]);
    assert.equal(results.filter(result => result.replayed).length, 1);
    assert.equal(results[0].hash, results[1].hash);
    assert.equal(h.db.state.wallets.sender.balance_ath, '80.00000000');
    assert.equal(h.db.state.operations.length, 1);
});
test('a lost PostgreSQL commit acknowledgment is recovered by the same key', async () => {
    const h = harness(); h.db.failCommitAck = true;
    await assert.rejects(send(h), error => error.message === 'Lost commit acknowledgment' && !error.code);
    assert.equal(h.db.state.wallets.sender.balance_ath, '80.00000000');
    const recovered = await send(h);
    assert.equal(recovered.replayed, true);
    assert.equal(h.db.state.wallets.sender.balance_ath, '80.00000000');
    assert.equal(h.db.state.operations.length, 1);
});
test('failed rollback discards the connection instead of returning an open transaction to the pool', async () => {
    const h = harness(); h.db.failInsert = true; h.db.failRollback = true;
    await assert.rejects(send(h), /durable-record failure/);
    assert.equal(h.db.discarded, 1);
    assert.equal(h.db.state.wallets.sender.balance_ath, '100.00000000');
    assert.equal(h.db.state.operations.length, 0);
});
test('failed receipt lookup never falsely certifies an earlier operation as not committed', async () => {
    const h = harness(); await send(h); h.db.failReceiptRead = true;
    await assert.rejects(send(h), error => !error.code && /Receipt lookup/.test(error.message));
    h.db.failReceiptRead = false;
    const recovered = await send(h);
    assert.equal(recovered.replayed, true);
    assert.equal(h.db.state.wallets.sender.balance_ath, '80.00000000');
});
test('reusing a key with different details is rejected without a second payment', async () => {
    const h = harness(); await send(h);
    await assert.rejects(send(h, key, 30), error => error.code === 'IDEMPOTENCY_CONFLICT');
    assert.equal(h.db.state.wallets.sender.balance_ath, '80.00000000');
});
test('new swap keys cannot bypass the newly persisted cooldown', async () => {
    const h = harness(); await swap(h);
    await assert.rejects(swap(h, 'different-operation-key-0002'), error => error.status === 429);
    assert.equal(h.db.state.users.sender.at_balance, '90.00000000');
});
test('disabled swap cooldown permits a deliberate second conversion', async () => {
    const h = harness(); h.db.state.settings.swap.cooldown_enabled = false;
    await swap(h); await swap(h, 'different-operation-key-0002');
    assert.equal(h.db.state.users.sender.at_balance, '80.00000000');
    assert.equal(h.db.state.users.sender.next_swap_at, null);
});
test('mining uses one pinned connection, credits AT and stores two history intents', async () => {
    const h = harness(); const result = await mine(h);
    assert.equal(result.value.reward, 2);
    assert.equal(result.value.newBalance, 102);
    assert.equal(h.db.state.users.sender.at_balance, '102.00000000');
    assert.equal(h.db.state.operations[0].events.length, 2);
    assert.equal(new Set(h.db.calls.map(call => call.client)).size, 1);
});
test('new mining keys cannot bypass the database cooldown', async () => {
    const h = harness(); await mine(h);
    await assert.rejects(mine(h, 'different-operation-key-0002'), error => error.status === 429);
    assert.equal(h.db.state.users.sender.at_balance, '102.00000000');
});
test('boost retries count once, and concurrent different keys respect the configured cap', async () => {
    const h = harness(); h.db.state.settings.daily_boost_max = '2';
    await mine(h, key, true); const replay = await mine(h, key, true);
    assert.equal(replay.replayed, true);
    const results = await Promise.allSettled([mine(h, 'different-boost-key-0002', true), mine(h, 'different-boost-key-0003', true)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(h.db.state.users.sender.current_cycle_boosts, 2);
    assert.equal(h.db.state.operations.every(op => op.delivered_at), true);
});
test('mining status remains in cooldown after a Redis reset and rejects blocked users', async () => {
    const h = harness(); await mine(h);
    const controller = h.load('src/controllers/mining.ts');
    let body; const response = { json(value) { body = value; }, status() { return this; } };
    await controller.getMiningStatus({ user: { id: 'sender' } }, response);
    assert.equal(body.canMine, false); assert.ok(body.timeLeft > 0);
    h.db.state.users.sender.last_mined_at = null; h.db.state.users.sender.is_blocked = true;
    await controller.getMiningStatus({ user: { id: 'sender' } }, response);
    assert.equal(body.canMine, false);
});
test('decimal transfers and conversions are exact at eight places', async () => {
    const h = harness(); await send(h, key, '0.12345678');
    assert.equal(h.db.state.wallets.receiver.balance_ath, '7.12345678');
    h.db.state.settings.swap.rate = '0.5';
    await swap(h, key, '0.00000002');
    assert.equal(h.db.state.wallets.sender.balance_ath, '99.87654323');
});
test('system credits resolve recipient account IDs and retain internal admin receipts', async () => {
    const h = harness();
    const result = await h.load('src/services/wallet.ts').WalletService.transfer(null, 'receiver', '1', 'admin_adjustment', 'ATH', key);
    assert.equal(result.success, true);
    assert.equal(h.db.state.wallets.receiver.balance_ath, '8.00000000');
    assert.equal(h.db.state.operations[0].events[0].document.type, 'system_credit');
});
