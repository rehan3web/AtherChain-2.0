import dotenv from 'dotenv';
import path from 'path';

// Load environment variables first
dotenv.config({ path: path.join(__dirname, '../.env') });

import pool from './db/postgres';

async function resetDatabase() {
    console.log('⏳ Connecting to database to clear all data...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('🧹 Truncating all user-related tables and resetting identities...');
        
        // List of all tables to truncate
        await client.query(`
            TRUNCATE TABLE 
                users, 
                wallets, 
                kyc_requests, 
                kyc_documents, 
                kyc_audit_logs, 
                kyc_status_history, 
                admin_audit_logs, 
                support_tickets, 
                ticket_messages, 
                system_settings, 
                referral_settings, 
                referral_rewards_log, 
                notifications, 
                notification_reads, 
                push_subscriptions, 
                device_fingerprints, 
                app_versions 
            RESTART IDENTITY CASCADE;
        `);

        // Re-insert default settings if needed (like referral settings)
        console.log('⚙️ Re-inserting default configurations...');
        await client.query(`
            INSERT INTO referral_settings (id, registration_reward_at, kyc_verified_reward_at)
            VALUES (1, 10, 50)
            ON CONFLICT (id) DO NOTHING;
        `);
        
        await client.query(`
            INSERT INTO system_settings (key, value)
            VALUES ('mining_cycle_hours', '24')
            ON CONFLICT (key) DO NOTHING;
        `);

        await client.query('COMMIT');
        console.log('✅ Database reset successfully! All tables cleared.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Database reset failed:', error);
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
}

resetDatabase();
