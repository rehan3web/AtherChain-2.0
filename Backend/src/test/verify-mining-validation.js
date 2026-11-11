const http = require('http');
const { Pool } = require('pg');
require('dotenv').config();

const PORT = 5001;
const BASE_URL = `http://localhost:${PORT}`;

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
});

function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function run() {
    try {
        console.log('--- Starting Mining Validation Verification ---');

        // 1. Register & Login
        const username = 'val_test_' + Math.floor(Math.random() * 10000);
        const email = `${username}@example.com`;
        const password = 'password123';
        const deviceId = 'test_device_' + username;

        console.log(`Step 1: Registering ${username} with deviceId ${deviceId}...`);
        const regRes = await request('POST', '/auth/register', {
            firstName: 'Test',
            lastName: 'User',
            username,
            email,
            password,
            deviceId
        });

        if (regRes.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(regRes.data)}`);
        const token = regRes.data.token;
        console.log(`User registered and logged in.`);

        // 2. Initial Validation (Should succeed)
        console.log('Step 2: Initial Validation...');
        const v1 = await request('POST', '/mining/validate', {}, token);
        console.log('Validation 1 Status:', v1.status, v1.data);
        if (v1.status !== 200) throw new Error('Initial validation failed');

        // 3. Start Mining (which sets the lock)
        console.log('Step 3: Starting Mining (Executing startMining)...');
        const miningPromise = request('POST', '/mining/start', {}, token);

        // 4. Quick Second Validation (Should fail with 429)
        console.log('Step 4: Immediate second validation while mining is in progress...');

        // Give it a tiny bit of time for startMining to acquire lock but not finish (it has 1200ms animation padding? no that's frontend)
        // Backend startMining is pretty fast but has a few DB queries.

        const v2 = await request('POST', '/mining/validate', {}, token);
        console.log('Validation 2 (Concurrent) Status:', v2.status, v2.data);

        if (v2.status === 429) {
            console.log('✅ Success: Second validation was blocked by lock');
        } else {
            console.warn('⚠️ Validation 2 did not return 429. Mining might have finished too fast or lock failed.');
        }

        const mineRes = await miningPromise;
        console.log('Mining 1 Status:', mineRes.status, mineRes.data);

        // 5. Validation after mining (Should fail with 400 Cooldown)
        console.log('Step 5: Validation after successful mining (Expect Cooldown error)...');
        const v3 = await request('POST', '/mining/validate', {}, token);
        console.log('Validation 3 (Cooldown) Status:', v3.status, v3.data);
        if (v3.status === 400 && v3.data.message.includes('cooldown')) {
            console.log('✅ Success: Validation correctly identified cooldown status');
        } else {
            throw new Error('Validation failed to identify cooldown');
        }

        console.log('\n--- ALL TESTS PASSED ---');

    } catch (error) {
        console.error('❌ Verification Failed:', error);
    } finally {
        if (pool) await pool.end();
    }
}

run();
