
const http = require('http');
const { Pool } = require('pg');
require('dotenv').config();

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

// DB Options
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
        console.log('--- Starting Session Verification ---');

        // 1. Register
        const username = 'sess_test_' + Math.floor(Math.random() * 10000);
        const email = `${username}@example.com`;
        const password = 'password123';

        console.log(`Step 1: Registering ${username}...`);
        const regRes = await request('POST', '/auth/register', {
            firstName: 'Test',
            lastName: 'User',
            username,
            email,
            password,
            phone: '1234567890'
        });

        if (regRes.status !== 201) {
            throw new Error(`Registration failed: ${JSON.stringify(regRes.data)}`);
        }
        const userId = regRes.data.userId;
        console.log(`User registered: ${userId}`);

        // 2. Verify Email in DB
        console.log('Step 2: verifying email in DB...');
        await pool.query('UPDATE users SET is_email_verified = true WHERE id = $1', [userId]);
        console.log('Email verified.');

        // 3. Login 1
        console.log('Step 3: Login 1...');
        const log1 = await request('POST', '/auth/login', { emailOrUsername: username, password });
        if (log1.status !== 200) throw new Error(`Login 1 failed: ${JSON.stringify(log1.data)}`);
        const token1 = log1.data.token;
        console.log('Login 1 successful.');

        // 4. Login 2
        console.log('Step 4: Login 2...');
        const log2 = await request('POST', '/auth/login', { emailOrUsername: username, password });
        if (log2.status !== 200) throw new Error(`Login 2 failed: ${JSON.stringify(log2.data)}`);
        const token2 = log2.data.token;
        console.log('Login 2 successful.');

        // 5. Login 3 (Should fail)
        console.log('Step 5: Login 3 (expect fail)...');
        const log3 = await request('POST', '/auth/login', { emailOrUsername: username, password });

        if (log3.status === 403 && log3.data.code === 'SESSION_LIMIT_EXCEEDED') {
            console.log('✅ Success: Login 3 failed with SESSION_LIMIT_EXCEEDED');
            const sessionMgmtToken = log3.data.sessionManagementToken;
            const sessions = log3.data.sessions;

            if (!sessionMgmtToken) throw new Error('No sessionManagementToken returned!');
            if (sessions.length < 2) throw new Error('Less than 2 sessions returned!');

            console.log(`Received session management token and ${sessions.length} sessions.`);

            // 6. Remove Session 1
            const sessionToRemove = sessions[0].id;
            console.log(`Step 6: Removing session ${sessionToRemove}...`);

            const delRes = await request('DELETE', `/auth/sessions/${sessionToRemove}`, null, sessionMgmtToken);
            if (delRes.status !== 200) {
                throw new Error(`Failed to remove session: ${JSON.stringify(delRes.data)}`);
            }
            console.log('✅ Session removed successfully.');

            // 7. Login 3 again (Should succeed)
            console.log('Step 7: Login 3 retry...');
            const log3Retry = await request('POST', '/auth/login', { emailOrUsername: username, password });
            if (log3Retry.status !== 200) throw new Error(`Login 3 retry failed: ${JSON.stringify(log3Retry.data)}`);
            console.log('✅ Login 3 retry successful.');

        } else {
            console.error('❌ Login 3 did not fail as expected:', log3.status, log3.data);
            throw new Error('Login 3 failed expectation');
        }

    } catch (error) {
        console.error('❌ Verification Failed:', error);
    } finally {
        // Cleanup
        try {
            if (pool) await pool.end();
            // Optional: delete user
            // await pool.query('DELETE FROM users WHERE username LIKE \$1', ['sess_test_%']);
        } catch (e) {
            console.error('Cleanup error:', e);
        }
    }
}

run();
