import { query } from '../db/postgres';
import Transaction from '../models/Transaction';

function identity(value: any) {
    return value && ['username', 'email', 'address'].includes(value.method)
        && typeof value.value === 'string' && value.value.trim() ? value : null;
}

/** Read-only recovery for receipts created before receiver metadata was saved. */
export async function receivedTransferMetadata(rows: any[]): Promise<Map<string, any>> {
    const missing = rows.filter(row => row.type === 'receive' && typeof row.txHash === 'string'
        && row.txHash.endsWith('_RCV')
        && (!identity(row.metadata?.recipient) || !identity(row.metadata?.sender)));
    const recovered = new Map<string, any>();
    if (!missing.length) return recovered;
    // One bounded lookup for the page, never one query per receipt.
    const sources = await Transaction.find({
        type: 'send', txHash: { $in: missing.map(row => row.txHash.slice(0, -4)) },
    });
    const byHash = new Map(sources.map(row => [row.txHash, row]));
    const pairs = missing.flatMap(row => {
        const source = byHash.get(row.txHash.slice(0, -4));
        if (!source || source.fromAddress !== row.fromAddress || source.toAddress !== row.toAddress
            || String(source.amount) !== String(row.amount) || !identity(source.metadata?.recipient)) return [];
        return [{ row, source }];
    });
    const ids = [...new Set(pairs.filter(({ source }) =>
        source.metadata.recipient.method !== 'address' && !identity(source.metadata.sender))
        .map(({ source }) => source.userId)
        .filter(id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))];
    const senders = ids.length
        ? await query('SELECT id,username FROM users WHERE id=ANY($1::uuid[])', [ids])
        : { rows: [] };
    const usernames = new Map(senders.rows.map(sender => [String(sender.id), sender.username]));
    for (const { row, source } of pairs) {
        const recipient = source.metadata.recipient;
        const username = usernames.get(String(source.userId));
        const sender = identity(source.metadata.sender) ?? (
            recipient.method !== 'address' && username
                ? { method: 'username', value: `@${String(username).replace(/^@/, '')}` }
                : { method: 'address', value: row.fromAddress });
        recovered.set(row.txHash, { ...row.metadata, recipient, sender });
    }
    return recovered;
}
