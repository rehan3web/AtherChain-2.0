import { Pool, types } from 'pg';
import { env } from '../config/env';
import fs from 'fs';
import path from 'path';

// Force TIMESTAMP (1114) to be parsed as UTC
types.setTypeParser(1114, (str) => {
    return new Date(str.replace(' ', 'T') + 'Z');
});

const sslConfig = () => {
    const caPath = path.join(__dirname, 'ca.pem');
    if (fs.existsSync(caPath)) {
        const caContent = fs.readFileSync(caPath).toString();

        // Host for Aiven/Cloud providers often needs to be explicitly set in servername
        const url = new URL(env.POSTGRES_URL);
        const servername = url.hostname;

        return {
            rejectUnauthorized: false,
            ca: caContent,
            servername: servername
        };
    }
    return { rejectUnauthorized: false }; // Try forcing it for production too
};

const pool = new Pool({
    connectionString: env.POSTGRES_URL.split('?')[0].replace(/^ppostgres/, 'postgres'), // Fix protocol if needed and remove ?sslmode=require
    ssl: env.POSTGRES_SSL ? sslConfig() : false,
});


pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
export const getClient = () => pool.connect();
export default pool;
