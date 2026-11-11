const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL.split('?')[0].replace(/^ppostgres/, 'postgres'),
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function checkUser() {
    try {
        const res = await pool.query("SELECT id, username, email, is_blocked, mining_paused, last_mined_at, expo_push_token FROM users WHERE username = 'rehan'");
        console.log("USER rehan DATABASE DATA:", res.rows[0]);
    } catch (e) {
        console.error("Error querying user:", e);
    } finally {
        await pool.end();
    }
}

checkUser();
