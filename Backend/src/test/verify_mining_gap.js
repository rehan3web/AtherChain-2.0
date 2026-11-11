
const axios = require('axios');
const { Pool } = require('pg');
const Redis = require('ioredis');
require('dotenv').config();

const PORT = process.env.PORT || 5001;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
});

const redis = new Redis(process.env.REDIS_URL);

async function runTest() {
    console.log('--- Starting Mining Gap Verification ---');

    try {
        // 1. Setup Test User
        const username = 'gap_test_' + Date.now();
        const email = `${username}@example.com`;
        const password = 'Password123!';

        console.log(`Step 1: Registering user ${username}...`);
        const regRes = await axios.post(`${BASE_URL}/auth/register`, {
            firstName: 'Gap',
            lastName: 'Test',
            username,
            email,
            password,
            phone: '1234567890',
            visitorId: 'gap_visitor_' + Date.now(),
            fingerprintComponents: {
                canvas: { value: { geometry: 'geo', text: 'text' } },
                vendor: { value: 'Mock' },
                platform: { value: 'Mock' }
            }
        });

        const userId = regRes.data.userId;
        await pool.query('UPDATE users SET is_email_verified = true, is_mining_enabled = true WHERE id = $1', [userId]);

        // 2. Login
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            emailOrUsername: username,
            password
        });
        const token = loginRes.data.token;

        // 3. First Mining Attempt (Should Succeed)
        console.log('Step 2: Performing first mining attempt...');
        const mine1 = await axios.post(`${BASE_URL}/mining/start`, {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`First Mine: ${mine1.status} - ${mine1.data.message}`);

        // 4. Bypass Redis Cooldown (Simulated)
        console.log('Step 3: Deleting Redis cooldown and lock to simulate bypass...');
        await redis.del(`mining_cooldown:${userId}`);
        await redis.del(`mining_lock:${userId}`);

        // 5. Second Mining Attempt (Should Fail at DB Level)
        console.log('Step 4: Performing second mining attempt (expect DB-level failure)...');
        try {
            const mine2 = await axios.post(`${BASE_URL}/mining/start`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.error(`❌ FAILURE: Second mine unexpectedly succeeded: ${mine2.status}`);
        } catch (err) {
            if (err.response && err.response.status === 500 && err.response.data.message.includes('Mining gap security')) {
                console.log(`✅ SUCCESS: Second mine failed as expected: ${err.response.status} - ${err.response.data.message}`);
            } else {
                console.error(`❌ FAILURE: Second mine failed with unexpected error: ${err.response ? err.response.status : err.message}`);
                if (err.response) console.error(err.response.data);
            }
        }

    } catch (error) {
        console.error('Test Execution Error:', error.response ? error.response.data : error.message);
    } finally {
        await pool.end();
        await redis.quit();
        process.exit();
    }
}

runTest();
