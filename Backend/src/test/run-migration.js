
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
});

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, 'src', 'db', 'migrations', 'create_device_fingerprints.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running migration from:', sqlPath);
        await pool.query(sql);
        console.log('Migration applied successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

runMigration();
