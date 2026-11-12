import pool from '../db/postgres';

export class SwapService {
    /**
     * Internal Swap Logic: AT -> ATH
     */
    static async swapATtoATH(userId: string, amountAT: number, rate: number): Promise<boolean> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const amountATH = amountAT * rate;

            // 1. Deduct AT from users table (at_balance)
            const deductRes = await client.query(
                'UPDATE users SET at_balance = at_balance - $1 WHERE id = $2 AND at_balance >= $3 RETURNING at_balance',
                [amountAT, userId, amountAT]
            );

            if (deductRes.rows.length === 0) {
                throw new Error('Insufficient AT balance');
            }

            // 2. Add ATH to wallets table (balance_ath)
            await client.query(
                'UPDATE wallets SET balance_ath = balance_ath + $1 WHERE user_id = $2',
                [amountATH, userId]
            );

            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

}
