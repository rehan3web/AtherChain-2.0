
const http = require('http');
require('dotenv').config();

const PORT = 5000;

function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
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
    console.log('--- Verifying Admin Stats Endpoint ---');

    try {
        // 1. Login as Admin
        console.log('Logging in as admin...');
        const loginRes = await request('POST', '/admin/login', { email: 'admin@ather.network', password: 'secret' });

        if (loginRes.status !== 200) {
            console.log('Login failed (expected if admin not seeded), using bypass or check manually.');
            // If login fails, we might need to seed an admin or just check the token generation logic.
            // Assuming admin exists from previous setup.
            console.log('Login Response:', loginRes.data);
            return;
        }

        const token = loginRes.data.token;
        console.log('Admin Token obtained.');

        // 2. Fetch Stats
        console.log('Fetching /admin/stats...');
        const statsRes = await request('GET', '/admin/stats', null, token);

        console.log('Stats Response Status:', statsRes.status);
        if (statsRes.status === 200) {
            console.log('Stats Data Keys:', Object.keys(statsRes.data));
            console.log('User Growth Data:', JSON.stringify(statsRes.data.userGrowth, null, 2));
            console.log('Country Dest Data:', JSON.stringify(statsRes.data.countryDistribution, null, 2));
        } else {
            console.log('Error Data:', statsRes.data);
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
