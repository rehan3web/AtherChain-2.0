import mongoose from 'mongoose';
import pool from '../db/postgres';
import Transaction from '../models/Transaction';
import MiningLog from '../models/MiningLog';
import { HistoryEvent } from './ledgerOperations';

let busy = false;

export async function flushLedgerHistory(): Promise<void> {
    if (busy || mongoose.connection.readyState !== 1) return;
    busy = true;
    try {
        for (let count = 0; count < 25; count++) {
            const client = await pool.connect();
            let id: string | undefined;
            let discard = false;
            try {
                await client.query('BEGIN');
                const pending = await client.query(
                    `SELECT id, events FROM ledger_operations
                     WHERE delivered_at IS NULL AND next_attempt_at <= NOW()
                     ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`
                );
                if (!pending.rowCount) { await client.query('COMMIT'); break; }
                id = pending.rows[0].id;
                const events: HistoryEvent[] = pending.rows[0].events;
                // Prevent account erasure racing with delayed MongoDB insertion.
                // A user DELETE waits until projection is finished, then removes history.
                const users = await client.query(
                    'SELECT id FROM users WHERE id=ANY($1::uuid[]) ORDER BY id FOR KEY SHARE',
                    [[...new Set(events.map(event => event.document.userId))]]
                );
                const active = new Set(users.rows.map(user => user.id));
                for (const event of events) {
                    if (!active.has(event.document.userId)) continue;
                    // Stable IDs and setOnInsert make partial batches/restarts safe to replay.
                    const filter = { _id: event.document._id };
                    const update = { $setOnInsert: event.document };
                    const options = { upsert: true, runValidators: true, timeoutMS: 3000,
                        writeConcern: { w: 'majority' as const, j: true } };
                    if (event.collection === 'transactions') await Transaction.updateOne(filter, update, options);
                    else await MiningLog.updateOne(filter, update, options);
                }
                await client.query(
                    `UPDATE ledger_operations SET delivered_at=NOW(), events='[]'::jsonb, attempts=attempts+1 WHERE id=$1`, [id]
                );
                await client.query('COMMIT');
            } catch {
                try { await client.query('ROLLBACK'); } catch { discard = true; }
                console.error('History delivery failed; committed balances are safe and delivery will retry.');
                if (id) {
                    await client.query(
                        `UPDATE ledger_operations SET attempts=attempts+1, next_attempt_at=NOW()+INTERVAL '10 seconds'
                         WHERE id=$1 AND delivered_at IS NULL`, [id]
                    ).catch(() => {});
                }
                break;
            } finally { client.release(discard); }
        }
    } finally { busy = false; }
}

export function startLedgerHistoryWorker() {
    void flushLedgerHistory().catch(() => console.error('History delivery will retry.'));
    const timer = setInterval(() => {
        void flushLedgerHistory().catch(() => console.error('History delivery will retry.'));
    }, 2000);
    timer.unref();
}
