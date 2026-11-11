
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL.split('?')[0],
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const res = await pool.query(`
            SELECT d.*, r.status as req_status, r.user_id 
            FROM kyc_documents d 
            JOIN kyc_requests r ON d.request_id = r.id 
            ORDER BY d.created_at DESC LIMIT 5
        `);
        console.log('Latest document-request links in DB:', res.rows.length);
        for (const doc of res.rows) {
            const absolutePath = path.resolve(process.cwd(), doc.file_path);
            const exists = fs.existsSync(absolutePath);
            console.log(`Doc ID: ${doc.id}, Type: ${doc.document_type}, Req Status: ${doc.req_status}, Path: ${doc.file_path}, Exists: ${exists}`);
        }

        const requests = await pool.query('SELECT id, user_id, status, full_name FROM kyc_requests ORDER BY submitted_at DESC LIMIT 5');
        console.log('\nLatest KYC Requests:');
        for (const req of requests.rows) {
            console.log(`Req ID: ${req.id}, User: ${req.user_id}, Status: ${req.status}, Name: ${req.full_name}`);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

check();
