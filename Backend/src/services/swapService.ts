import { Types } from 'mongoose';
import { LedgerError, runOperation } from './ledgerOperations';
import { decimal, money, multiply } from './ledgerMoney';

export class SwapService {
    static async swapATtoATH(userId: string, amount: unknown, key: string) {
        const amountAT = decimal(money(amount));
        return runOperation(userId, 'swap', key, { amountAT }, async (client, id) => {
            const settingsResult = await client.query("SELECT value FROM system_settings WHERE key='swap'");
            const settings = settingsResult.rows[0]?.value;
            if (!settings?.active) throw new LedgerError(400, 'Internal swap settings disabled');
            const account = await client.query(
                'SELECT kyc_status,is_blocked,is_swap_enabled,swap_paused,next_swap_at FROM users WHERE id=$1', [userId]
            );
            const user = account.rows[0];
            if (user.is_blocked || user.kyc_status !== 'approved' || user.swap_paused || user.is_swap_enabled === false)
                throw new LedgerError(403, 'Swap is not available for this account. Approved KYC is required.');
            if (settings.cooldown_enabled !== false && user.next_swap_at && new Date(user.next_swap_at).getTime() > Date.now())
                throw new LedgerError(429, 'Swap cooldown is active');
            const hours = Number(settings.cooldown_hours ?? 24);
            if (!Number.isFinite(hours) || hours <= 0 || hours > 8760)
                throw new LedgerError(503, 'Invalid swap cooldown configuration');
            let rate: bigint;
            try { rate = money(settings.rate); }
            catch { throw new LedgerError(503, 'Invalid swap rate configuration'); }
            const amountATH = decimal(multiply(money(amountAT), rate));
            const deducted = await client.query(
                'UPDATE users SET at_balance=at_balance-$1 WHERE id=$2 AND at_balance >= $1 RETURNING at_balance',
                [amountAT, userId]
            );
            if (deducted.rowCount !== 1) throw new LedgerError(400, 'Insufficient AT balance');
            const credited = await client.query(
                'UPDATE wallets SET balance_ath=balance_ath+$1 WHERE user_id=$2 RETURNING balance_ath',
                [amountATH, userId]
            );
            if (credited.rowCount !== 1) throw new LedgerError(409, 'Destination wallet not found; no funds were converted');
            await client.query(
                `UPDATE users SET next_swap_at=CASE WHEN $2 THEN NOW()+($3 * INTERVAL '1 hour') ELSE NULL END WHERE id=$1`,
                [userId, settings.cooldown_enabled !== false, hours]
            );
            const txId = new Types.ObjectId().toHexString();
            const hash = `ATH_SWAP_${id.replace(/-/g, '').toUpperCase()}`;
            const receipt = { fromAmount: Number(amountAT), toAmount: Number(amountATH), rate: Number(decimal(rate)), createdAt: new Date().toISOString() };
            return {
                value: { success: true, status: 'completed', message: 'Swap completed instantly', txId, hash, receipt },
                events: [{
                    collection: 'transactions',
                    document: {
                        _id: txId, userId, txHash: hash, type: 'swap', amount: amountATH, status: 'completed',
                        createdAt: new Date().toISOString(),
                        metadata: { fromToken: 'AT', toToken: 'ATH', fromAmount: Number(amountAT), toAmount: Number(amountATH), rate: Number(decimal(rate)) }
                    }
                }]
            };
        });
    }
}
