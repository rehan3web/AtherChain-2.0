import pool from './postgres';

const getColumnDetails = async () => {
    const client = await pool.connect();
    try {
        console.log('--- Columns with Defaults in users ---');
        const res = await client.query(`
            SELECT column_name, data_type, character_maximum_length, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY column_name
        `);
        res.rows.forEach(row => {
            console.log(`- ${row.column_name}: ${row.data_type} (${row.character_maximum_length || 'unlimited'}) DEFAULT ${row.column_default}`);
        });

    } catch (e) {
        console.error('Error getting column details:', e);
    } finally {
        client.release();
        process.exit(0);
    }
};

getColumnDetails();
