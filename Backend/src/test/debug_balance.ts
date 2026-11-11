import pool from '../db/postgres';

const check = async () => {
    const userId = 'a8a619fe-cc37-4c29-a1fd-ea70de0f5f5a';
    try {
        const res = await pool.query('SELECT user_id, balance_at, address FROM wallets WHERE user_id = $1', [userId]);
        console.log('--- WALLET DATA ---');
        console.log(JSON.stringify(res.rows, null, 2));

        const userRes = await pool.query('SELECT id, username FROM users WHERE id = $1', [userId]);
        console.log('--- USER DATA ---');
        console.log(JSON.stringify(userRes.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
};

check();
