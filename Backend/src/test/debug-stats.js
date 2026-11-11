
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
});

async function run() {
    console.log('--- Inspecting User Data for Charts ---');

    try {
        // 1. Check Total Users
        const total = await pool.query('SELECT COUNT(*) FROM users');
        console.log(`Total Users: ${total.rows[0].count}`);

        // 2. Check Users with Country
        const withCountry = await pool.query('SELECT country, COUNT(*) FROM users WHERE country IS NOT NULL GROUP BY country');
        console.log('Users by Country:');
        console.table(withCountry.rows);

        // 3. Check Recent Users (Last 30 Days)
        const recent = await pool.query(`
            SELECT DATE(created_at) as date, COUNT(*) 
            FROM users 
            WHERE created_at >= NOW() - INTERVAL '30 days' 
            GROUP BY DATE(created_at) 
            ORDER BY date
        `);
        console.log('Recent Daily Signups:');
        console.table(recent.rows);

        // 4. Check Date Distribution (All time) if recent is empty
        if (recent.rows.length === 0) {
            const allTime = await pool.query(`
                SELECT DATE(created_at) as date, COUNT(*) 
                FROM users 
                GROUP BY DATE(created_at) 
                ORDER BY date DESC
                LIMIT 5
            `);
            console.log('Latest 5 days with signups (All Time):');
            console.table(allTime.rows);
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

run();
