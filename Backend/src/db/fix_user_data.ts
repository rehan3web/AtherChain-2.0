
import pool from './postgres';

const fixUserData = async () => {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting User Data Cleanup...');

        // 1. Find user zerpkelly
        const userRes = await client.query('SELECT id, username, at_balance, mining_sessions_count, mining_days_count FROM users WHERE username = $1', ['zerpkelly']);

        if (userRes.rows.length === 0) {
            console.log('❌ User zerpkelly not found.');
            return;
        }

        const user = userRes.rows[0];
        console.log(`Current state for ${user.username}:`);
        console.log(`- ID: ${user.id}`);
        console.log(`- Balance: ${user.at_balance}`);
        console.log(`- Sessions: ${user.mining_sessions_count}`);
        console.log(`- Days: ${user.mining_days_count}`);

        const excessSessions = user.mining_sessions_count - user.mining_days_count;
        if (excessSessions <= 0) {
            console.log('✅ Sessions count is already normal.');
            return;
        }

        // Calculate deduction. Assuming 1.0 per session (default)
        // If the user has boosts, it might be more, but 1.0 is the baseline.
        const deduction = excessSessions * 1.0;

        console.log(`\nProposed corrections:`);
        console.log(`- Set sessions count to: ${user.mining_days_count}`);
        console.log(`- Deduct balance: ${deduction}`);
        console.log(`- New balance will be: ${parseFloat(user.at_balance) - deduction}`);

        await client.query('BEGIN');

        await client.query(
            `UPDATE users 
             SET mining_sessions_count = $1, 
                 at_balance = GREATEST(0, at_balance - $2) 
             WHERE id = $3`,
            [user.mining_days_count, deduction, user.id]
        );

        await client.query('COMMIT');
        console.log('\n✅ Data corrected successfully!');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Data Cleanup Failed:', e);
    } finally {
        client.release();
        process.exit(0);
    }
};

fixUserData();
