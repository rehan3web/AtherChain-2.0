import pool from '../db/postgres';
import { WalletService } from '../services/wallet';

const fix = async () => {
    const userId = 'a8a619fe-cc37-4c29-a1fd-ea70de0f5f5a'; // rerefcs
    try {
        console.log(`Checking wallet for user: ${userId}`);
        const res = await pool.query('SELECT * FROM wallets WHERE user_id = $1', [userId]);

        if (res.rows.length === 0) {
            console.log('Wallet missing. Creating...');
            const { address } = await WalletService.createWallet();

            await pool.query(
                `INSERT INTO wallets (user_id, address, balance_at, balance_ath)
                 VALUES ($1, $2, 0, 0)`,
                [userId, address]
            );
            console.log(`Wallet created and saved for ${userId}: ${address}`);
        } else {
            console.log('Wallet already exists.');
        }
    } catch (e) {
        console.error('Fix Error:', e);
    } finally {
        process.exit(0);
    }
};

fix();
