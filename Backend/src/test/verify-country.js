
const http = require('http');
const { Pool } = require('pg');
require('dotenv').config();

const PORT = 5000;

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
});

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function run() {
    console.log('--- Verifying Country Field ---');
    const suffix = Math.floor(Math.random() * 100000);
    const country = "United States";
    const user = {
        firstName: 'Country', lastName: 'Test',
        username: `country_user_${suffix}`,
        email: `country_user_${suffix}@example.com`,
        password: 'password123',
        phone: '1234567890',
        visitorId: `device_country_${suffix}`,
        country: country
    };

    try {
        // 1. Register with Country
        console.log(`1. Registering user with country: ${country}...`);
        let res = await request('POST', '/auth/register', user);

        if (res.status !== 201) throw new Error(`Registration failed: ${res.data.message}`);
        const userId = res.data.userId;
        console.log('✅ User registered.');

        // 2. Verify Database
        console.log('2. checking database...');
        const dbRes = await pool.query('SELECT country FROM users WHERE id = $1', [userId]);
        const dbCountry = dbRes.rows[0]?.country;

        if (dbCountry !== country) {
            throw new Error(`Database mismatch: Expected ${country}, got ${dbCountry}`);
        }
        console.log(`✅ Database confirmed country: ${dbCountry}`);

    } catch (e) {
        console.error('❌ Verification Failed:', e);
    } finally {
        await pool.end();
    }
}

run();
