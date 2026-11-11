/**
 * ============================================================
 * Migration Script: Face Scan Data → File System
 * ============================================================
 * 
 * This script migrates existing encrypted face_scan_frame data
 * from the kyc_requests table (TOAST bloat ~883 MB) to disk files,
 * then runs VACUUM FULL to reclaim the space.
 * 
 * WHAT IT DOES:
 * 1. Reads all kyc_requests that have face_scan_frame data
 * 2. Decrypts the encrypted base64 data
 * 3. Saves each face scan as a .jpg file in uploads/kyc/
 * 4. Updates the DB row to store the file path instead
 * 5. Runs VACUUM FULL to reclaim ~883 MB of disk space
 * 
 * HOW TO RUN:
 *   npx ts-node src/migrate_face_scans.ts
 * 
 * OR inside Docker:
 *   docker exec -it <container_name> npx ts-node src/migrate_face_scans.ts
 */

import pool from './db/postgres';
import { decrypt } from './services/encryption';
import fs from 'fs';
import path from 'path';

const FACE_SCAN_DIR = 'uploads/kyc';

async function migrateFaceScans() {
    const client = await pool.connect();

    try {
        console.log('='.repeat(60));
        console.log('🚀 Face Scan Migration Script');
        console.log('='.repeat(60));

        // Ensure output directory exists
        if (!fs.existsSync(FACE_SCAN_DIR)) {
            fs.mkdirSync(FACE_SCAN_DIR, { recursive: true });
        }

        // 1. Count total rows with face_scan_frame data
        const countRes = await client.query(`
            SELECT COUNT(*) as total 
            FROM kyc_requests 
            WHERE face_scan_frame IS NOT NULL 
              AND face_scan_frame != ''
        `);
        const total = parseInt(countRes.rows[0].total);
        console.log(`\n📊 Found ${total} rows with face_scan_frame data to migrate`);

        if (total === 0) {
            console.log('✅ Nothing to migrate! All face scans are already cleaned up.');
            console.log('\n🧹 Running VACUUM FULL anyway to reclaim any leftover TOAST space...');
            await client.query('VACUUM FULL kyc_requests');
            console.log('✅ VACUUM FULL complete!');
            return;
        }

        // 2. Check current table size before migration
        const sizeBefore = await client.query(`
            SELECT pg_size_pretty(pg_total_relation_size('kyc_requests')) as total_size
        `);
        console.log(`📦 Current kyc_requests size: ${sizeBefore.rows[0].total_size}`);

        // 3. Process in batches of 50 to avoid memory issues
        const BATCH_SIZE = 50;
        let migrated = 0;
        let skipped = 0;
        let errors = 0;

        for (let offset = 0; offset < total; offset += BATCH_SIZE) {
            const batchRes = await client.query(`
                SELECT id, user_id, face_scan_frame 
                FROM kyc_requests 
                WHERE face_scan_frame IS NOT NULL 
                  AND face_scan_frame != ''
                ORDER BY submitted_at ASC
                LIMIT $1 OFFSET $2
            `, [BATCH_SIZE, offset]);

            for (const row of batchRes.rows) {
                try {
                    const { id, user_id, face_scan_frame } = row;

                    // Skip if it's already a file path (not encrypted data)
                    // Encrypted data has format: iv_hex:authtag_hex:encrypted_hex (contains colons)
                    // File paths look like: uploads/kyc/xxx-face_scan-xxx.jpg
                    if (!face_scan_frame.includes(':')) {
                        console.log(`  ⏭️  [${id}] Already a file path, skipping`);
                        skipped++;
                        continue;
                    }

                    // Decrypt the encrypted base64 data
                    let base64Data: string;
                    try {
                        base64Data = decrypt(face_scan_frame);
                    } catch (decryptErr) {
                        console.error(`  ❌ [${id}] Failed to decrypt, skipping:`, (decryptErr as Error).message);
                        errors++;
                        continue;
                    }

                    // Strip data URI prefix if present
                    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

                    // Decode base64 to binary
                    const imageBuffer = Buffer.from(cleanBase64, 'base64');

                    // Validate it's actually image data (JPEG starts with FF D8, PNG with 89 50)
                    if (imageBuffer.length < 100) {
                        console.error(`  ⚠️  [${id}] Decoded data too small (${imageBuffer.length} bytes), skipping`);
                        errors++;
                        continue;
                    }

                    // Determine file extension from data
                    let ext = '.jpg';
                    if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) ext = '.png';
                    if (imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49) ext = '.webp';

                    // Save to disk
                    const filename = `${user_id}-face_scan-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
                    const filePath = path.join(FACE_SCAN_DIR, filename).replace(/\\/g, '/');
                    fs.writeFileSync(filePath, imageBuffer);

                    // Update DB row to store file path instead of encrypted blob
                    await client.query(
                        `UPDATE kyc_requests SET face_scan_frame = $1 WHERE id = $2`,
                        [filePath, id]
                    );

                    migrated++;
                    console.log(`  ✅ [${migrated}/${total}] ${id} → ${filePath} (${(imageBuffer.length / 1024).toFixed(1)} KB)`);

                } catch (rowErr) {
                    console.error(`  ❌ [${row.id}] Error:`, (rowErr as Error).message);
                    errors++;
                }
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 Migration Summary:');
        console.log(`   ✅ Migrated: ${migrated}`);
        console.log(`   ⏭️  Skipped:  ${skipped}`);
        console.log(`   ❌ Errors:   ${errors}`);
        console.log('='.repeat(60));

        // 4. VACUUM FULL to reclaim TOAST space
        console.log('\n🧹 Running VACUUM FULL kyc_requests...');
        console.log('   ⚠️  This will lock the table — please wait...');

        // Release the client before VACUUM (it can't run inside a transaction)
        client.release();

        // Use a fresh connection for VACUUM
        const vacuumClient = await pool.connect();
        await vacuumClient.query('VACUUM FULL kyc_requests');
        
        // Check size after
        const sizeAfter = await vacuumClient.query(`
            SELECT pg_size_pretty(pg_total_relation_size('kyc_requests')) as total_size
        `);
        vacuumClient.release();

        console.log('\n🎉 VACUUM FULL complete!');
        console.log(`   📦 Before: ${sizeBefore.rows[0].total_size}`);
        console.log(`   📦 After:  ${sizeAfter.rows[0].total_size}`);
        console.log(`   💾 Space reclaimed!`);
        console.log('='.repeat(60));

        return; // Skip the finally release since we already released

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        client.release();
        process.exit(1);
    }
}

// Run
migrateFaceScans()
    .then(() => {
        console.log('\n✅ Migration script finished successfully!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n❌ Fatal error:', err);
        process.exit(1);
    });

