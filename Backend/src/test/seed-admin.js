
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
});

async function run() {
    console.log('--- Seeding Admin User ---');
    const email = 'admin@example.com';
    const password = 'admin'; // In production, use strong password

    try {
        const client = await pool.connect();

        // Check if admin exists
        const res = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (res.rows.length > 0) {
            console.log('Admin user already exists.');
            // Update password just in case
            const hashedPassword = await bcrypt.hash(password, 10);
            await client.query('UPDATE users SET password_hash = $1, role = $2 WHERE email = $3', [hashedPassword, 'admin', email]);
            console.log('Admin password updated.');
        } else {
            console.log('Creating admin user...');
            const hashedPassword = await bcrypt.hash(password, 10);
            const referralCode = 'ADMIN001';

            await client.query(
                `INSERT INTO users (first_name, last_name, username, email, phone, password_hash, referral_code, role, at_balance, is_swap_enabled, is_mining_enabled, is_transfer_enabled, is_email_verified)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, TRUE, TRUE, TRUE, TRUE)`,
                ['System', 'Admin', 'admin', email, '0000000000', hashedPassword, referralCode, 'admin']
            );
            console.log('Admin user created.');
        }
        client.release();
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

run();
