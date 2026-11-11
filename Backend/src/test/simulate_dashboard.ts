import pool from '../db/postgres';

const simulate = async () => {
    const userId = 'a8a619fe-cc37-4c29-a1fd-ea70de0f5f5a'; // rerefcs
    try {
        const userRes = await pool.query(
            `SELECT u.username, u.email, u.referral_code, 
                    w.balance_at, w.address 
             FROM users u
             LEFT JOIN wallets w ON u.id = w.user_id
             WHERE u.id = $1`,
            [userId]
        );

        console.log('QUERY RESULTS:');
        console.log(JSON.stringify(userRes.rows, null, 2));

        const userData = userRes.rows[0];
        console.log('userData.balance_at TYPE:', typeof userData.balance_at);
        console.log('userData.balance_at VALUE:', userData.balance_at);

        const response = {
            balanceAT: userData.balance_at ?? '0',
            balance_at: userData.balance_at ?? '0'
        };

        console.log('JSON RESPONSE FIELD balanceAT:', JSON.stringify(response.balanceAT));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
};

simulate();
