
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL.split('?')[0],
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Running migration...');
        await pool.query(`
            ALTER TABLE kyc_requests 
            ADD COLUMN IF NOT EXISTS dob DATE, 
            ADD COLUMN IF NOT EXISTS id_expiry DATE, 
            ADD COLUMN IF NOT EXISTS language VARCHAR(50);
        `);
        console.log('Migration complete!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

run();
