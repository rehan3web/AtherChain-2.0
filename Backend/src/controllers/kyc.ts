import { Request, Response } from 'express';
import pool, { query } from '../db/postgres';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Transaction from '../models/Transaction';
import { WalletService } from '../services/wallet';

// 1. Configure Multer for Secure Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/kyc';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req: any, file, cb) => {
        // Use user ID and timestamp for unique, secure file names
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `${req.user.id}-${file.fieldname}-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req: any, file: any, cb: any) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, PNG, and WEBP allowed.'), false);
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB Limit per file
        fieldSize: 10 * 1024 * 1024 // 10MB Limit for text fields (face scan base64)
    }
});

/**
 * Submit KYC Application
 */
import { KYCService } from '../services/kyc';

// ... (imports remain)

/**
 * Submit KYC Application
 */
export const submitKyc = async (req: Request | any, res: Response) => {
    const userId = req.user.id;

    // 0. Check Eligibility (New)
    try {
        const eligibility = await KYCService.checkEligibility(userId);
        if (!eligibility.eligible) {
            return res.status(403).json({
                message: 'You are not eligible for KYC verification.',
                reasons: eligibility.reasons
            });
        }
    } catch (error) {
        console.error('Eligibility check failed:', error);
        return res.status(500).json({ message: 'Failed to verify eligibility.' });
    }

    const {
        full_name, father_name, address, city, country, id_type, id_number,
        verification_score, verification_logs, face_scan_frame, country_code,
        dob, id_expiry, language
    } = req.body;
    // ... (rest of the function remains the same until the end)
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!full_name || !father_name || !address || !city || !country || !id_type || !id_number || !dob || !id_expiry || !language) {
        return res.status(400).json({ message: 'Missing required information' });
    }

    if (!files || !files.id_front || !files.id_back) {
        return res.status(400).json({ message: 'Missing required documents' });
    }

    if (!face_scan_frame) {
        return res.status(400).json({ message: 'Live face scan is mandatory' });
    }

    const client = await pool.connect();
    let faceScanPath: string | undefined;
    try {
        await client.query('BEGIN');

        // 1. Check User Eligibility (Database Status)
        const userRes = await client.query('SELECT kyc_status, is_blocked FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0];

        if (user.is_blocked) throw new Error('Blocked nodes cannot submit authorization requests.');
        if (user.kyc_status === 'pending') throw new Error('Identification protocol already in progress.');
        if (user.kyc_status === 'approved') throw new Error('Identity already verified.');

        // 2. Clear Old Data if Re-submitting from REJECTED
        if (user.kyc_status === 'rejected') {
            const oldRequest = await client.query('SELECT id, face_scan_frame FROM kyc_requests WHERE user_id = $1', [userId]);
            if (oldRequest.rows.length > 0) {
                const oldReq = oldRequest.rows[0];
                // Delete face scan file if it's a file path
                if (oldReq.face_scan_frame && !oldReq.face_scan_frame.includes(':') && fs.existsSync(oldReq.face_scan_frame)) {
                    fs.unlinkSync(oldReq.face_scan_frame);
                }
                // Delete physical document files
                const docRes = await client.query('SELECT file_path FROM kyc_documents WHERE request_id = $1', [oldReq.id]);
                for (const doc of docRes.rows) {
                    if (fs.existsSync(doc.file_path)) fs.unlinkSync(doc.file_path);
                }
                // Cascading delete will handle DB rows for documents and request
                await client.query('DELETE FROM kyc_requests WHERE id = $1', [oldReq.id]);
            }
        }

        // 3. Save face scan to disk (NOT in database — avoids TOAST bloat)
        const faceScanDir = 'uploads/kyc';
        if (!fs.existsSync(faceScanDir)) {
            fs.mkdirSync(faceScanDir, { recursive: true });
        }
        const faceScanFilename = `${userId}-face_scan-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
        faceScanPath = path.join(faceScanDir, faceScanFilename).replace(/\\/g, '/');
        // Strip the data URI prefix if present, then decode base64 to binary
        const base64Data = face_scan_frame.replace(/^data:image\/\w+;base64,/, '');
        const faceScanBuffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(faceScanPath, faceScanBuffer);

        // 4. Create New KYC Request (store file PATH, not image data)
        const requestRes = await client.query(
            `INSERT INTO kyc_requests 
                (user_id, full_name, father_name, address, city, country, id_type, id_number, status, 
                 verification_score, verification_logs, face_scan_frame, country_code, dob, id_expiry, language)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, $12, $13, $14, $15)
             RETURNING id`,
            [
                userId, full_name, father_name, address, city, country, id_type, id_number,
                verification_score || 0,
                verification_logs || {},
                faceScanPath,
                country_code || null,
                dob, id_expiry, language
            ]
        );
        const requestId = requestRes.rows[0].id;

        // 5. Store Documents
        const documentTypes = ['id_front', 'id_back'];
        for (const type of documentTypes) {
            const file = files[type][0];
            const normalizedPath = file.path.replace(/\\/g, '/');
            await client.query(
                `INSERT INTO kyc_documents (request_id, document_type, file_path)
                 VALUES ($1, $2, $3)`,
                [requestId, type, normalizedPath]
            );
        }

        // 6. Update User Global Status
        await client.query(`UPDATE users SET kyc_status = 'pending' WHERE id = $1`, [userId]);

        // 7. Log Status History
        await client.query(
            `INSERT INTO kyc_status_history (user_id, request_id, status)
             VALUES ($1, $2, 'pending')`,
            [userId, requestId]
        );

        await client.query('COMMIT');
        res.json({ message: 'KYC Application submitted for nodes inspection.' });

    } catch (error: any) {
        await client.query('ROLLBACK');
        // Cleanup uploaded files on failure
        if (files) {
            Object.values(files).flat().forEach(f => {
                if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
            });
        }
        // Cleanup face scan file on failure
        if (typeof faceScanPath === 'string' && fs.existsSync(faceScanPath)) {
            fs.unlinkSync(faceScanPath);
        }
        console.error('KYC Submission Error:', error);
        res.status(500).json({ message: error.message || 'Submission failed' });
    } finally {
        client.release();
    }
};

/**
 * Get Current KYC Status and History
 */
export const getKycStatus = async (req: Request | any, res: Response) => {
    const userId = req.user.id;

    try {
        const userRes = await query('SELECT kyc_status, kyc_rejection_reason FROM users WHERE id = $1', [userId]);
        const historyRes = await query(
            `SELECT status, reason, changed_at FROM kyc_status_history 
             WHERE user_id = $1 ORDER BY changed_at DESC`,
            [userId]
        );

        // Fetch eligibility
        const eligibility = await KYCService.checkEligibility(userId);

        // Fetch latest request details for the receipt
        const requestRes = await query(
            `SELECT full_name, id_type, id_number, country, submitted_at as submittedAt 
             FROM kyc_requests 
             WHERE user_id = $1 
             ORDER BY submitted_at DESC LIMIT 1`,
            [userId]
        );
        const latestRequest = requestRes.rows[0] || {};

        // Fetch user balance
        let balance_ath = '0';
        const walletRes = await query('SELECT address FROM wallets WHERE user_id = $1', [userId]);
        if (walletRes.rows.length > 0) {
            balance_ath = await WalletService.getBalance(walletRes.rows[0].address);
        }

        res.json({
            status: userRes.rows[0].kyc_status,
            rejectionReason: userRes.rows[0].kyc_rejection_reason,
            history: historyRes.rows,
            eligibility, // Added eligibility data
            balance_ath, // Added balance data
            ...latestRequest
        });
    } catch (error) {
        console.error('Get KYC Status Error:', error);
        res.status(500).json({ message: 'Failed to fetch identity status' });
    }
};

/**
 * Get KYC Configuration (Identity Types)
 */
export const getKycConfig = async (req: Request, res: Response) => {
    res.json({
        idTypes: [
            { id: 'CNIC', label: 'CNIC / ID CARD' },
            { id: 'PASSPORT', label: 'INTERNATIONAL PASSPORT' },
            { id: 'DRIVING_LICENSE', label: 'DRIVING LICENSE' }
        ]
    });
};

/**
 * Admin: Get KYC Rules
 */
export const getKycRules = async (req: Request, res: Response) => {
    try {
        const rules = await KYCService.getRules();
        res.json(rules);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch KYC rules' });
    }
};

/**
 * Admin: Update KYC Rules
 */
export const updateKycRules = async (req: Request, res: Response) => {
    try {
        const rules = req.body;
        const updated = await KYCService.updateRules(rules);
        res.json({ message: 'KYC Rules updated', rules: updated });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update KYC rules' });
    }
};


/**
 * Verify Twitter Follow Task
 */
export const verifyTwitterFollow = async (req: Request | any, res: Response) => {
    const userId = req.user.id;
    const { twitter_username } = req.body;

    if (!twitter_username) {
        return res.status(400).json({ message: 'Twitter username is required' });
    }

    try {
        await query(
            `UPDATE users SET twitter_username = $1, is_twitter_followed = TRUE WHERE id = $2`,
            [twitter_username, userId]
        );
        res.json({ message: 'Twitter task verified successfully' });
    } catch (error) {
        console.error('Verify Twitter Follow Error:', error);
        res.status(500).json({ message: 'Failed to verify Twitter task' });
    }
};
