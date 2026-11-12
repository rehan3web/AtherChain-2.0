import { createHash, randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import pool from '../db/postgres';

export class LedgerError extends Error {
    constructor(public status: number, message: string, public code = 'NOT_COMMITTED') { super(message); }
}

// A delivery queue and replay receipts, not a replacement for MongoDB history.
// Payloads are cleared after successful delivery. Account deletion cascades.
export const ledgerSchema = `
CREATE TABLE IF NOT EXISTS ledger_operations (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    request_key VARCHAR(128) NOT NULL,
    fingerprint TEXT NOT NULL,
    result JSONB NOT NULL,
    events JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, kind, request_key)
);
CREATE INDEX IF NOT EXISTS ledger_delivery_pending
ON ledger_operations(next_attempt_at) WHERE delivered_at IS NULL;
`;

export interface HistoryEvent {
    collection: 'transactions' | 'mining';
    document: Record<string, any>;
}
interface OperationResult<T> { value: T; events: HistoryEvent[] }

export function requestKey(req: any): string {
    const key = req.get?.('Idempotency-Key') ?? req.headers?.['idempotency-key'];
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key))
        throw new LedgerError(400, 'A valid Idempotency-Key header is required. Update the app and retry.', 'INVALID_OPERATION_KEY');
    return key;
}

export async function runOperation<T>(
    userId: string, kind: string, key: string, payload: unknown,
    effect: (client: PoolClient, operationId: string) => Promise<OperationResult<T>>
): Promise<{ value: T; replayed: boolean; historyPending: boolean }> {
    const client = await pool.connect();
    let began = false;
    let discard = false;
    let commitAttempted = false;
    let newOperation = false;
    try {
        await client.query('BEGIN');
        began = true;
        // Stable per-user lock also serializes different keys/cycles across processes.
        const user = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
        if (!user.rowCount) throw new LedgerError(404, 'Account not found');
        const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
        const previous = await client.query(
            'SELECT fingerprint, result, delivered_at FROM ledger_operations WHERE user_id=$1 AND kind=$2 AND request_key=$3',
            [userId, kind, key]
        );
        if (previous.rowCount) {
            const receipt = previous.rows[0];
            if (receipt.fingerprint !== fingerprint)
                throw new LedgerError(409, 'This operation key was already used with different details.', 'IDEMPOTENCY_CONFLICT');
            await client.query('COMMIT');
            began = false;
            return { value: receipt.result, replayed: true, historyPending: !receipt.delivered_at };
        }
        newOperation = true;
        const id = randomUUID();
        const result = await effect(client, id);
        await client.query(
            `INSERT INTO ledger_operations(id,user_id,kind,request_key,fingerprint,result,events,delivered_at)
             VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,CASE WHEN $8 THEN NOW() ELSE NULL END)`,
            [id, userId, kind, key, fingerprint, JSON.stringify(result.value), JSON.stringify(result.events), result.events.length === 0]
        );
        commitAttempted = true;
        await client.query('COMMIT');
        began = false;
        return { value: result.value, replayed: false, historyPending: result.events.length > 0 };
    } catch (error) {
        let rolledBack = false;
        if (began) {
            try { await client.query('ROLLBACK'); rolledBack = true; }
            catch { discard = true; }
        }
        if (newOperation && rolledBack && !commitAttempted && !(error instanceof LedgerError))
            throw new LedgerError(503, 'Operation was rolled back; no funds changed. Please retry later.');
        throw error;
    } finally { client.release(discard); }
}

export function ledgerResponse(error: unknown, res: any) {
    if (error instanceof LedgerError) return res.status(error.status).json({ message: error.message, code: error.code });
    console.error('Financial operation failed; retry using the same operation key.');
    return res.status(503).json({ message: 'Operation could not be confirmed. Retry with the same operation key.' });
}
