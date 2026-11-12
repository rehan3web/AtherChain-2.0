import { query } from '../db/postgres';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';

export class WalletService {

    static async createWallet() {
        // Internal ledger identifier; no signing credentials are created.
        const randomHex = randomBytes(20).toString('hex');
        const address = `ATH_${randomHex.toUpperCase()}`;

        return {
            address: address,
        };
    }

    static async getBalance(address: string) {
        const res = await query('SELECT balance_ath FROM wallets WHERE address = $1', [address]);
        return res.rows[0]?.balance_ath || '0.00';
    }

    // Internal Transfer Logic (Database-only)
    static async transfer(senderId: string | null, recipientIdentifier: string, amount: string, type: string = 'send', symbol: string = 'ATH') {
        if (symbol !== 'ATH') throw new Error('Only internal ATH transfers are supported.');
        const pool = (await import('../db/postgres')).default;
        const Transaction = (await import('../models/Transaction')).default;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const amountNum = parseFloat(amount);

            // 1. Resolve Sender
            let senderAddress = this.getTreasuryAddress();
            let senderActualId = 'SYSTEM_TREASURY';

            if (senderId) {
                const senderRes = await client.query('SELECT address, balance_ath FROM wallets WHERE user_id = $1', [senderId]);
                const sender = senderRes.rows[0];
                if (!sender) throw new Error('Sender wallet not found');
                senderAddress = sender.address;
                senderActualId = senderId;

                // Deduct from Sender
                const deductRes = await client.query(
                    `UPDATE wallets SET balance_ath = balance_ath - $1 
                     WHERE user_id = $2 AND balance_ath >= $3 
                     RETURNING balance_ath`,
                    [amountNum, senderId, amountNum]
                );
                if (deductRes.rows.length === 0) throw new Error('Insufficient balance');
            }

            // 2. Resolve Recipient
            const recipientRes = await client.query(
                `SELECT u.id, w.address FROM users u JOIN wallets w ON u.id = w.user_id 
                 WHERE w.address = $1 OR u.email = $1 OR u.username = $1`,
                [recipientIdentifier]
            );
            const recipient = recipientRes.rows[0];

            if (!recipient) {
                // If recipient is treasury address
                if (recipientIdentifier === this.getTreasuryAddress()) {
                    // Nothing to update in DB for treasury yet if we don't have a row for it
                } else {
                    throw new Error('Recipient not found');
                }
            } else {
                // Add to Recipient
                await client.query(
                    `UPDATE wallets SET balance_ath = balance_ath + $1 WHERE user_id = $2`,
                    [amountNum, recipient.id]
                );
            }

            const txHash = `ATH_TX_${uuidv4().replace(/-/g, '').toUpperCase()}`;

            // 3. Log in MongoDB
            if (senderId) {
                await Transaction.create({
                    userId: senderId,
                    txHash,
                    type: type,
                    amount: String(amount),
                    status: 'completed',
                    fromAddress: senderAddress,
                    toAddress: recipient?.address || recipientIdentifier,
                    fee: '0.00'
                });
            }

            if (recipient) {
                await Transaction.create({
                    userId: recipient.id,
                    txHash: `${txHash}_RCV`,
                    type: senderId ? (type === 'send' ? 'receive' : type) : 'system_credit',
                    amount: String(amount),
                    status: 'completed',
                    fromAddress: senderAddress,
                    toAddress: recipient.address,
                    fee: '0.00'
                });
            }

            await client.query('COMMIT');
            return { success: true, hash: txHash };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static isAddress(address: string) {
        // Validate internal format: ATH_ followed by 40 hex chars
        return /^ATH_[0-9A-F]{40}$/i.test(address);
    }

    static getTreasuryAddress() {
        return "ATH_TREASURY_SYSTEM_REWARDS_001";
    }
}
