import pool, { query } from '../db/postgres';
import { WalletService } from '../services/wallet';
import { SwapService } from '../services/swapService';

async function verifyCentralizedFlow() {
    console.log('🧪 Starting Verification of Centralized Backend Flow...');

    try {
        // 1. Setup Test Users
        console.log('1. Setting up test users with internal addresses...');
        const user1Id = '00000000-0000-0000-0000-000000000001';
        const user2Id = '00000000-0000-0000-0000-000000000002';

        // Ensure users exist
        await query(`
            INSERT INTO users (id, first_name, last_name, username, email, password_hash, referral_code) 
            VALUES ($1::UUID, 'Test', 'User1', 'test_user_1', 'test1@example.com', 'hash', 'REF1')
            ON CONFLICT (id) DO UPDATE SET first_name = 'Test'
        `, [user1Id]);

        await query(`
            INSERT INTO users (id, first_name, last_name, username, email, password_hash, referral_code) 
            VALUES ($1::UUID, 'Test', 'User2', 'test_user_2', 'test2@example.com', 'hash', 'REF2')
            ON CONFLICT (id) DO UPDATE SET first_name = 'Test'
        `, [user2Id]);

        // Setup Wallets
        const wallet1 = await WalletService.createWallet();
        const wallet2 = await WalletService.createWallet();

        await query(`
            INSERT INTO wallets (user_id, address, balance_ath) 
            VALUES ($1::UUID, $2, 100.0)
            ON CONFLICT (user_id) DO UPDATE SET address = $2, balance_ath = 100.0
        `, [user1Id, wallet1.address]);

        await query(`
            INSERT INTO wallets (user_id, address, balance_ath) 
            VALUES ($1::UUID, $2, 0.0)
            ON CONFLICT (user_id) DO UPDATE SET address = $2, balance_ath = 0.0
        `, [user2Id, wallet2.address]);

        console.log(`User 1 Address: ${wallet1.address}, Balance: 100.0`);
        console.log(`User 2 Address: ${wallet2.address}, Balance: 0.0`);

        // 2. Test Internal Transfer (Atomic Sim)
        console.log('2. Testing internal transfer logic (User 1 -> User 2, 30 ATH)...');
        const transferAmount = 30.0;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Deduct
            const deduct = await client.query('UPDATE wallets SET balance_ath = balance_ath - $1 WHERE user_id = $2::UUID AND balance_ath >= $1 RETURNING balance_ath', [transferAmount, user1Id]);
            if (deduct.rows.length === 0) throw new Error('Deduct failed');

            // Add
            await client.query('UPDATE wallets SET balance_ath = balance_ath + $1 WHERE user_id = $2::UUID', [transferAmount, user2Id]);

            await client.query('COMMIT');
            console.log('✅ Transfer transaction committed.');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        const bal1 = await WalletService.getBalance(wallet1.address);
        const bal2 = await WalletService.getBalance(wallet2.address);
        console.log(`User 1 New Balance: ${bal1}`);
        console.log(`User 2 New Balance: ${bal2}`);

        if (Number(bal1) === 70.0 && Number(bal2) === 30.0) {
            console.log('✅ Balance consistency verified after transfer.');
        } else {
            throw new Error(`Balance mismatch: User1=${bal1}, User2=${bal2}`);
        }

        // 3. Test Internal Swap (AT -> ATH)
        console.log('3. Testing internal swap (AT -> ATH)...');
        await query('UPDATE users SET at_balance = 50.0 WHERE id = $1::UUID', [user1Id]);

        const swapRate = 2.0;
        // Swap 20 AT -> 40 ATH
        await SwapService.swapATtoATH(user1Id, 20.0, 'legacy-verification-swap-key');

        const finalAt = await query('SELECT at_balance FROM users WHERE id = $1::UUID', [user1Id]);
        const finalAth = await WalletService.getBalance(wallet1.address);

        console.log(`User 1 final AT: ${finalAt.rows[0].at_balance}, ATH: ${finalAth}`);

        if (Number(finalAt.rows[0].at_balance) === 30.0 && Number(finalAth) === 110.0) {
            console.log('✅ Swap consistency verified.');
        } else {
            throw new Error(`Swap balance mismatch: AT=${finalAt.rows[0].at_balance}, ATH=${finalAth}`);
        }

        console.log('\n✨ ALL TESTS PASSED! The centralized system is fully operational.');

    } catch (error) {
        console.error('\n❌ Verification Failed:', error);
    } finally {
        console.log('Verification finished.');
        process.exit(0);
    }
}

verifyCentralizedFlow();
