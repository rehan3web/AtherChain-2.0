import { randomBytes, randomUUID } from 'crypto';
import { Types } from 'mongoose';
import { query } from '../db/postgres';
import { HistoryEvent, LedgerError, runOperation } from './ledgerOperations';
import { decimal, money } from './ledgerMoney';

export class WalletService {
    static async createWallet() { return { address: `ATH_${randomBytes(20).toString('hex').toUpperCase()}` }; }

    static async getBalance(address: string) {
        const result = await query('SELECT balance_ath FROM wallets WHERE address=$1', [address]);
        return result.rows[0]?.balance_ath || '0.00';
    }

    static async transfer(
        senderId: string | null, recipientIdentifier: string, amount: unknown,
        type = 'send', symbol = 'ATH', key: string = randomUUID()
    ) {
        if (symbol !== 'ATH') throw new LedgerError(400, 'Only internal ATH transfers are supported.');
        const amountText = decimal(money(amount));
        const recipient = String(recipientIdentifier).trim();
        let actorId = senderId;
        if (!actorId) {
            const target = await query(
                `SELECT u.id FROM users u JOIN wallets w ON w.user_id=u.id
                 WHERE w.address=$1 OR u.email=$1 OR u.username=$1 OR u.id::text=$1`, [recipient]
            );
            if (!target.rowCount) throw new LedgerError(404, 'Recipient not found');
            actorId = target.rows[0].id;
        }
        const operation = await runOperation(actorId!, `transfer:${type}`, key, { senderId, recipient, amount: amountText }, async (client, id) => {
            const senderResult = senderId
                ? await client.query('SELECT is_blocked,is_transfer_enabled,transfer_paused FROM users WHERE id=$1', [senderId])
                : null;
            if (type === 'send') {
                const sender = senderResult?.rows[0];
                if (!sender || sender.is_blocked || sender.transfer_paused || sender.is_transfer_enabled === false)
                    throw new LedgerError(403, 'Transfers are disabled for this account');
                const global = await client.query("SELECT value FROM system_settings WHERE key='transfer'");
                if (global.rows[0]?.value?.active === false) throw new LedgerError(403, 'Transfers are temporarily disabled');
            }
            const treasury = recipient === this.getTreasuryAddress();
            if (type === 'send' && treasury) throw new LedgerError(400, 'Recipient must be another app account');
            const target = treasury ? null : await client.query(
                `SELECT u.id FROM users u JOIN wallets w ON w.user_id=u.id
                 WHERE w.address=$1 OR u.email=$1 OR u.username=$1 OR u.id::text=$1`, [recipient]
            );
            const recipientId: string | undefined = target?.rows[0]?.id;
            if (!treasury && !recipientId) throw new LedgerError(404, 'Recipient not found');
            if (senderId === recipientId) throw new LedgerError(400, 'Cannot send to yourself');
            const ids = [senderId, recipientId].filter(Boolean) as string[];
            const wallets = await client.query(
                'SELECT user_id,address FROM wallets WHERE user_id=ANY($1::uuid[]) ORDER BY user_id FOR UPDATE', [ids]
            );
            if (wallets.rowCount !== ids.length) throw new LedgerError(409, 'A wallet is unavailable; no funds were transferred');
            const addresses = new Map<string, string>(wallets.rows.map(row => [row.user_id, row.address]));
            if (senderId) {
                const debit = await client.query(
                    'UPDATE wallets SET balance_ath=balance_ath-$1 WHERE user_id=$2 AND balance_ath >= $1 RETURNING balance_ath',
                    [amountText, senderId]
                );
                if (debit.rowCount !== 1) throw new LedgerError(400, 'Insufficient ATH balance');
            }
            if (recipientId) {
                const credit = await client.query(
                    'UPDATE wallets SET balance_ath=balance_ath+$1 WHERE user_id=$2 RETURNING balance_ath', [amountText, recipientId]
                );
                if (credit.rowCount !== 1) throw new LedgerError(409, 'Recipient wallet is unavailable; no funds were transferred');
            }
            const hash = `ATH_TX_${id.replace(/-/g, '').toUpperCase()}`;
            const base = { amount: amountText, status: 'completed', fee: '0.00', createdAt: new Date().toISOString(),
                fromAddress: senderId ? addresses.get(senderId) : this.getTreasuryAddress(),
                toAddress: recipientId ? addresses.get(recipientId) : recipient };
            const events: HistoryEvent[] = [];
            // Save how the sender addressed this payment, not just the resolved wallet.
            // This is part of the durable outbox event, including idempotent recovery.
            const method = recipient === addresses.get(recipientId!) || /^[0-9a-f-]{36}$/i.test(recipient)
                ? 'address' : recipient.includes('@') ? 'email' : 'username';
            if (senderId) events.push({ collection: 'transactions', document: {
                ...base, _id: new Types.ObjectId().toHexString(), userId: senderId, txHash: hash, type,
                metadata: { recipient: { method, value: method === 'username' ? `@${recipient}` : recipient } }
            } });
            if (recipientId) events.push({ collection: 'transactions', document: {
                ...base, _id: new Types.ObjectId().toHexString(), userId: recipientId, txHash: `${hash}_RCV`,
                type: senderId ? (type === 'send' ? 'receive' : type) : 'system_credit'
            } });
            return { value: { success: true, message: 'Transfer successful', hash, fee: '0.00' }, events };
        });
        // Keep the established admin-service result shape.
        return { ...operation.value, historyPending: operation.historyPending, replayed: operation.replayed };
    }

    static isAddress(address: string) { return /^ATH_[0-9A-F]{40}$/i.test(address); }
    static getTreasuryAddress() { return 'ATH_TREASURY_SYSTEM_REWARDS_001'; }
}
