
import pool from '../postgres';

const migrate = async () => {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting Fingerprint Migration...');
        await client.query('BEGIN');

        const columns = [
            "browser VARCHAR(100)",
            "os VARCHAR(100)",
            "screen_resolution VARCHAR(50)",
            "gpu TEXT",
            "fonts TEXT",
            "canvas_hash TEXT",
            "components_json JSONB"
        ];

        for (const col of columns) {
            const colName = col.split(' ')[0];
            await client.query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='device_fingerprints' AND column_name='${colName}') THEN 
                        ALTER TABLE device_fingerprints ADD COLUMN ${col}; 
                    END IF;
                END $$;
            `);
        }

        await client.query('COMMIT');
        console.log('✅ Fingerprint Migration successful!');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Migration Failed:', e);
    } finally {
        client.release();
        process.exit(0);
    }
};

migrate();
