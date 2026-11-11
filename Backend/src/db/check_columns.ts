import pool from './postgres';

const checkColumns = async () => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'device_fingerprints'
        `);
        console.log('Columns in device_fingerprints:');
        res.rows.forEach(row => {
            console.log(`- ${row.column_name}: ${row.data_type}`);
        });
    } catch (e) {
        console.error('Error checking columns:', e);
    } finally {
        client.release();
        process.exit(0);
    }
};

checkColumns();
