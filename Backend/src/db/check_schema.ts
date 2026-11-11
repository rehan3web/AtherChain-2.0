import pool from './postgres';

const checkColumns = async () => {
    const client = await pool.connect();
    try {
        console.log('--- Columns in users ---');
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        res.rows.forEach(row => console.log(`- ${row.column_name}: ${row.data_type}`));

        console.log('\n--- Columns in wallets ---');
        const res2 = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'wallets'
        `);
        res2.rows.forEach(row => console.log(`- ${row.column_name}: ${row.data_type}`));

        console.log('\n--- Columns in system_settings ---');
        const res3 = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'system_settings'
        `);
        res3.rows.forEach(row => console.log(`- ${row.column_name}: ${row.data_type}`));

    } catch (e) {
        console.error('Error checking columns:', e);
    } finally {
        client.release();
        process.exit(0);
    }
};

checkColumns();
