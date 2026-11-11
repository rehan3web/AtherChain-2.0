import { Request, Response } from 'express';
import pool, { query } from '../db/postgres';
import fs from 'fs';
import path from 'path';
import { ReferralController } from './referral';

/**
 * List KYC Requests with filtering and pagination
 */
export const listKycRequests = async (req: Request | any, res: Response) => {
    const { status = 'pending', country, search, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    try {
        let sql = `
            SELECT k.*, u.username, u.email 
            FROM kyc_requests k
            JOIN users u ON k.user_id = u.id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (status && status !== 'all') {
            params.push(status);
            sql += ` AND k.status = $${params.length}`;
        }

        if (country) {
            params.push(country);
            sql += ` AND k.country = $${params.length}`;
        }

        if (search) {
            params.push(`%${search}%`);
            sql += ` AND (u.username ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.id::text ILIKE $${params.length})`;
        }

        // Add count before pagination
        const countRes = await query(`SELECT COUNT(*) FROM (${sql}) as t`, params);
        const total = parseInt(countRes.rows[0].count);

        sql += ` ORDER BY k.submitted_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await query(sql, params);

        res.json({
            requests: result.rows,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        console.error('List KYC Error:', error);
        res.status(500).json({ message: 'Error fetching KYC requests' });
    }
};

/**
 * Get detailed KYC request with documents
 */
export const getKycDetails = async (req: Request | any, res: Response) => {
    const { requestId } = req.params;

    try {
        const requestRes = await query(
            `SELECT k.*, u.username, u.email 
             FROM kyc_requests k
             JOIN users u ON k.user_id = u.id
             WHERE k.id = $1`,
            [requestId]
        );

        if (requestRes.rows.length === 0) {
            return res.status(404).json({ message: 'Request not found' });
        }

        const documentsRes = await query(
            `SELECT id, document_type, created_at FROM kyc_documents WHERE request_id = $1`,
            [requestId]
        );

        const request = requestRes.rows[0];
        // face_scan_frame now stores a file path, not encrypted data
        // We include it as-is; the admin panel can use the serve endpoint to view it

        res.json({
            request: request,
            documents: documentsRes.rows
        });
    } catch (error) {
        console.error('Get KYC Details Error:', error);
        res.status(500).json({ message: 'Error fetching KYC details' });
    }
};

/**
 * Approve KYC Request
 */
export const approveKyc = async (req: Request | any, res: Response) => {
    const { requestId } = req.params;
    const adminId = req.admin?.email || 'system_admin';

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Get request details
        const reqRes = await client.query('SELECT * FROM kyc_requests WHERE id = $1', [requestId]);
        if (reqRes.rows.length === 0) throw new Error('Request not found');
        const kycReq = reqRes.rows[0];

        if (kycReq.status !== 'pending') throw new Error('Request already processed');

        // 2. Update Status to Approved
        await client.query(
            `UPDATE kyc_requests SET status = 'approved', updated_at = NOW() WHERE id = $1`,
            [requestId]
        );

        // 3. Mark user as kyc_verified
        await client.query(
            `UPDATE users SET kyc_status = 'approved', kyc_verified = true WHERE id = $1`,
            [kycReq.user_id]
        );

        // 4. Log Audit
        await client.query(
            `INSERT INTO kyc_audit_logs (request_id, admin_id, action, prev_status, new_status, created_at)
             VALUES ($1, $2, 'approve', 'pending', 'approved', NOW())`,
            [requestId, adminId]
        );

        // 5. Delete Physical Files (documents + face scan)
        const docRes = await client.query('SELECT file_path FROM kyc_documents WHERE request_id = $1', [requestId]);
        for (const doc of docRes.rows) {
            if (fs.existsSync(doc.file_path)) {
                fs.unlinkSync(doc.file_path);
            }
        }
        // Delete face scan file
        if (kycReq.face_scan_frame && fs.existsSync(kycReq.face_scan_frame)) {
            fs.unlinkSync(kycReq.face_scan_frame);
        }

        // 6. Remove document records (Optional but requirement says permanently delete images)
        await client.query('DELETE FROM kyc_documents WHERE request_id = $1', [requestId]);

        // 7. Clear face scan path from DB
        await client.query(`UPDATE kyc_requests SET face_scan_frame = NULL WHERE id = $1`, [requestId]);

        // 8. Trigger Referral Reward (KYC Bonus)
        const userRes = await client.query('SELECT referred_by FROM users WHERE id = $1', [kycReq.user_id]);
        const user = userRes.rows[0];
        if (user && user.referred_by) {
            // Apply reward (internal function handles logging and atomic balance update)
            await ReferralController.applyReward(user.referred_by, kycReq.user_id, 'kyc');
        }

        await client.query('COMMIT');
        res.json({ message: 'KYC Approved and rewards processed' });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Approve KYC Error:', error);
        res.status(500).json({ message: error.message || 'Approval failed' });
    } finally {
        client.release();
    }
};

/**
 * Reject KYC Request
 */
export const rejectKyc = async (req: Request | any, res: Response) => {
    const { requestId } = req.params;
    const { reason } = req.body;
    const adminId = req.admin?.email || 'system_admin';

    if (!reason) {
        return res.status(400).json({ message: 'Rejection reason is mandatory' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Get request details
        const reqRes = await client.query('SELECT * FROM kyc_requests WHERE id = $1', [requestId]);
        if (reqRes.rows.length === 0) throw new Error('Request not found');
        const kycReq = reqRes.rows[0];

        if (kycReq.status !== 'pending') throw new Error('Request already processed');

        // 2. Update Status to Rejected
        await client.query(
            `UPDATE kyc_requests SET status = 'rejected', rejection_reason = $1, updated_at = NOW() WHERE id = $2`,
            [reason, requestId]
        );

        // 3. Update User Status (but keep verified=false)
        await client.query(
            `UPDATE users SET kyc_status = 'rejected', kyc_verified = false, kyc_rejection_reason = $1 WHERE id = $2`,
            [reason, kycReq.user_id]
        );

        // 4. Log Audit
        await client.query(
            `INSERT INTO kyc_audit_logs (request_id, admin_id, action, prev_status, new_status, reason, created_at)
             VALUES ($1, $2, 'reject', 'pending', 'rejected', $3, NOW())`,
            [requestId, adminId, reason]
        );

        // 5. Delete Physical Files (documents + face scan)
        const docRes = await client.query('SELECT file_path FROM kyc_documents WHERE request_id = $1', [requestId]);
        for (const doc of docRes.rows) {
            if (fs.existsSync(doc.file_path)) {
                fs.unlinkSync(doc.file_path);
            }
        }
        // Delete face scan file
        if (kycReq.face_scan_frame && fs.existsSync(kycReq.face_scan_frame)) {
            fs.unlinkSync(kycReq.face_scan_frame);
        }

        // 6. Delete document records
        await client.query('DELETE FROM kyc_documents WHERE request_id = $1', [requestId]);

        // 7. Clear face scan path from DB
        await client.query(`UPDATE kyc_requests SET face_scan_frame = NULL WHERE id = $1`, [requestId]);

        await client.query('COMMIT');
        res.json({ message: 'KYC Rejected and documents purged' });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Reject KYC Error:', error);
        res.status(500).json({ message: error.message || 'Rejection failed' });
    } finally {
        client.release();
    }
};

/**
 * Securely stream/serve KYC documents to admin
 */
export const serveKycDocument = async (req: Request | any, res: Response) => {
    const { documentId } = req.params;

    try {
        const docRes = await query('SELECT file_path FROM kyc_documents WHERE id = $1', [documentId]);
        if (docRes.rows.length === 0) {
            return res.status(404).json({ message: 'Document not found or already deleted' });
        }

        const rawPath = docRes.rows[0].file_path;
        // Ensure path is resolved relative to project root
        const filePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);

        if (!fs.existsSync(filePath)) {
            console.error(`❌ KYC Document missing at path: ${filePath}`);
            return res.status(404).json({ message: 'Physical file missing from storage' });
        }

        const ext = path.extname(filePath).toLowerCase();
        let contentType = 'image/jpeg';
        if (ext === '.png') contentType = 'image/png';
        if (ext === '.webp') contentType = 'image/webp';

        const stat = fs.statSync(filePath);
        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stat.size
        });

        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
    } catch (error) {
        console.error('Serve KYC Doc Error:', error);
        res.status(500).json({ message: 'Error serving document' });
    }
};


/**
 * Securely serve KYC face scan image to admin
 */
export const serveFaceScan = async (req: Request | any, res: Response) => {
    const { requestId } = req.params;

    try {
        const result = await query(
            'SELECT face_scan_frame FROM kyc_requests WHERE id = $1',
            [requestId]
        );

        if (result.rows.length === 0 || !result.rows[0].face_scan_frame) {
            return res.status(404).json({ message: 'Face scan not found' });
        }

        const rawPath = result.rows[0].face_scan_frame;
        const filePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);

        if (!fs.existsSync(filePath)) {
            console.error(`❌ Face scan file missing at path: ${filePath}`);
            return res.status(404).json({ message: 'Face scan file missing from storage' });
        }

        const ext = path.extname(filePath).toLowerCase();
        let contentType = 'image/jpeg';
        if (ext === '.png') contentType = 'image/png';
        if (ext === '.webp') contentType = 'image/webp';

        const stat = fs.statSync(filePath);
        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stat.size
        });

        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
    } catch (error) {
        console.error('Serve Face Scan Error:', error);
        res.status(500).json({ message: 'Error serving face scan' });
    }
};
