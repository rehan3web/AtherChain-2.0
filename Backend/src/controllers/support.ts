import { Request, Response } from 'express';
import pool, { query } from '../db/postgres';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { emailService } from '../services/emailService';
import SupportBroadcaster from '../services/SupportBroadcaster';

async function sendExpoPushNotification(expoPushToken: string, title: string, body: string, data?: any) {
    if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) return;
    try {
        await axios.post('https://exp.host/--/api/v2/push/send', {
            to: expoPushToken,
            title,
            body,
            data: data || {},
            sound: 'default',
            priority: 'high',
        }, {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            timeout: 8000,
        });
    } catch (err) {
        console.error('Expo push notification error:', err);
    }
}

// 1. Configure Multer for Support Tickets
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/support';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req: any, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `support-${uniqueSuffix}${ext}`);
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

export const supportUpload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});

const deleteTicketFiles = (filenames: (string | null)[]) => {
    filenames.forEach(filename => {
        if (filename) {
            const filePath = path.join('uploads/support', filename);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (err) {
                    console.error(`Failed to delete file ${filename}:`, err);
                }
            }
        }
    });
};

/**
 * Create a support ticket (User)
 */
export const createTicket = async (req: Request, res: Response) => {
    const { title, message, userId, name, username, email } = req.body;
    const user_id = (req as any).user?.id || userId;
    const file = req.file;

    if ((!title && !name) || !message) {
        return res.status(400).json({ message: 'Title/Name and message are required' });
    }

    try {
        await query('BEGIN');

        // 1. Create Ticket
        const ticketRes = await query(
            `INSERT INTO support_tickets (user_id, title, name, username, email, message, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', NOW(), NOW())
             RETURNING id`,
            [user_id || null, title || 'Support Appeal', name || null, username || null, email || null, message]
        );
        const ticketId = ticketRes.rows[0].id;

        // 2. Create Initial Message
        await query(
            `INSERT INTO ticket_messages (ticket_id, sender_id, is_admin, message, image_url)
             VALUES ($1, $2, FALSE, $3, $4)`,
            [ticketId, user_id || null, message, file ? file.filename : null]
        );

        await query('COMMIT');

        const resultMessage = {
            id: Date.now(), // Temporary ID for real-time
            ticket_id: ticketId,
            sender_id: user_id || null,
            is_admin: false,
            message,
            image_url: file ? file.filename : null,
            created_at: new Date()
        };
        SupportBroadcaster.broadcastMessage(ticketId, resultMessage);

        res.status(201).json({
            message: 'Support ticket created successfully.',
            ticketId
        });
    } catch (error) {
        await query('ROLLBACK');
        console.error('Create Ticket Error:', error);
        res.status(500).json({ message: 'Failed to create ticket' });
    }
};

/**
 * Public Appeal (for blocked users)
 */
export const createAppeal = async (req: Request, res: Response) => {
    const { name, username, email, message } = req.body;
    const file = req.file;

    if (!name || !email || !message) {
        return res.status(400).json({ message: 'Name, email and message are required' });
    }

    try {
        await query('BEGIN');

        // Find user if possible for reference, but don't block
        const userRes = await query('SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1', [email, username]);
        const user_id = userRes.rows[0]?.id || null;

        // 1. Create Ticket
        const ticketRes = await query(
            `INSERT INTO support_tickets (user_id, title, name, username, email, message, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', NOW(), NOW())
             RETURNING id`,
            [user_id, 'Account Appeal', name, username, email, message]
        );
        const ticketId = ticketRes.rows[0].id;

        // 2. Create Initial Message
        await query(
            `INSERT INTO ticket_messages (ticket_id, sender_id, is_admin, message, image_url)
             VALUES ($1, $2, FALSE, $3, $4)`,
            [ticketId, user_id, message, file ? file.filename : null]
        );

        await query('COMMIT');

        const resultMessage = {
            id: Date.now(), // Temporary ID for real-time
            ticket_id: ticketId,
            sender_id: user_id,
            is_admin: false,
            message,
            image_url: file ? file.filename : null,
            created_at: new Date()
        };
        SupportBroadcaster.broadcastMessage(ticketId, resultMessage);

        res.status(201).json({
            message: 'Support appeal submitted successfully.',
            ticketId
        });
    } catch (error) {
        await query('ROLLBACK');
        console.error('Create Appeal Error:', error);
        res.status(500).json({ message: 'Failed to submit appeal' });
    }
};

/**
 * List tickets (User or Admin)
 */
export const listTickets = async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { status, page = 1 } = req.query;
    const limit = 20;
    const offset = (Number(page) - 1) * limit;

    try {
        let sql = `
            SELECT t.*, 
                   COALESCE(t.name, CONCAT(u.first_name, ' ', u.last_name), 'Unknown User') as name, 
                   COALESCE(t.username, u.username, 'N/A') as username, 
                   COALESCE(t.email, u.email, 'N/A') as email,
                   COALESCE(u.is_blocked, FALSE) as is_user_blocked
            FROM support_tickets t
            LEFT JOIN users u ON t.user_id = u.id
        `;
        const params: any[] = [];

        // Filter by User vs Admin
        if (user?.role !== 'admin') {
            sql += ` WHERE t.user_id = $1`;
            params.push(user.id);
        } else {
            sql += ` WHERE 1=1`;
        }

        if (status) {
            sql += ` AND t.status = $${params.length + 1}`;
            params.push(status);
        }

        sql += ` ORDER BY t.updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await query(sql, params);

        // Count for pagination
        let countSql = `SELECT COUNT(*) FROM support_tickets t`;
        const countParams: any[] = [];

        if (user?.role !== 'admin') {
            countSql += ` WHERE t.user_id = $1`;
            countParams.push(user.id);
        } else {
            countSql += ` WHERE 1=1`;
        }
        if (status) {
            countSql += ` AND t.status = $${countParams.length + 1}`;
            countParams.push(status);
        }

        const countRes = await query(countSql, countParams);

        res.json({
            tickets: result.rows,
            pagination: {
                total: parseInt(countRes.rows[0].count),
                page: Number(page),
                pages: Math.ceil(parseInt(countRes.rows[0].count) / limit)
            }
        });
    } catch (error) {
        console.error('List Tickets Error:', error);
        res.status(500).json({ message: 'Failed to fetch tickets' });
    }
};

/**
 * Get Ticket Details with Messages
 */
export const getTicketDetails = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;

    try {
        // 1. Get Ticket with User Info
        const ticketRes = await query(`
            SELECT t.*, 
                   COALESCE(t.name, CONCAT(u.first_name, ' ', u.last_name), 'Unknown User') as name, 
                   COALESCE(t.username, u.username, 'N/A') as username, 
                   COALESCE(t.email, u.email, 'N/A') as email,
                   COALESCE(u.is_blocked, FALSE) as is_user_blocked
            FROM support_tickets t
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.id = $1
        `, [id]);

        if (ticketRes.rows.length === 0) return res.status(404).json({ message: 'Ticket not found' });

        const ticket = ticketRes.rows[0];

        // Authorization Check
        if (user?.role !== 'admin' && ticket.user_id !== user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // 2. Get Messages
        const messagesRes = await query(
            `SELECT * FROM ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC`,
            [id]
        );

        res.json({
            ticket,
            messages: messagesRes.rows
        });
    } catch (error) {
        console.error('Get Ticket Details Error:', error);
        res.status(500).json({ message: 'Error fetching ticket details' });
    }
};

/**
 * Reply to Ticket (User or Admin)
 */
export const replyTicket = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { message, status } = req.body; // Status update is optional/admin only usually
    const user = (req as any).user;
    const file = req.file;

    if (!message && !file && !status) {
        return res.status(400).json({ message: 'Message, file, or status update is required' });
    }

    try {
        await query('BEGIN');

        // 1. Check Ticket
        const ticketRes = await query('SELECT * FROM support_tickets WHERE id = $1', [id]);
        if (ticketRes.rows.length === 0) {
            throw new Error('Ticket not found');
        }
        const ticket = ticketRes.rows[0];

        // Authorization
        if (user?.role !== 'admin' && ticket.user_id !== user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Logic: Can reply?
        if (['RESOLVED', 'REJECTED'].includes(ticket.status) && user?.role !== 'admin') {
            return res.status(400).json({ message: 'Ticket is closed. You cannot reply.' });
        }

        const isAdmin = user?.role === 'admin';

        let insertedMessage: any = null;
        // 2. Insert Message (Only if message or file exists)
        if (message || file) {
            // If admin, usage 'admin-001' fails UUID check. Set sender_id to NULL for admins.
            const insertRes = await query(
                `INSERT INTO ticket_messages (ticket_id, sender_id, is_admin, message, image_url)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [id, isAdmin ? null : user.id, isAdmin, message || '', file ? file.filename : null]
            );
            insertedMessage = insertRes.rows[0];
        }

        // 3. Update Status
        let newStatus = ticket.status;
        if (isAdmin) {
            // Admin reply -> OPEN (unless explicitly setting solved/closed)
            if (status) {
                newStatus = status;
            } else if (ticket.status === 'PENDING') {
                newStatus = 'OPEN';
            }
        } else {
            // User reply -> No status change usually, or Re-open if solved?
            // Requirement: "User can reply if ticket status is Pending, Open".
            // If user reply, keep current status.
        }

        await query(
            `UPDATE support_tickets SET status = $1, updated_at = NOW() WHERE id = $2`,
            [newStatus, id]
        );

        // Requirement: Purge all data if Resolved or Rejected
        if (['RESOLVED', 'REJECTED'].includes(newStatus)) {
            // 1. Get all image URLs to delete files
            const messagesRes = await query('SELECT image_url FROM ticket_messages WHERE ticket_id = $1', [id]);
            const ticketRes = await query('SELECT image_url FROM support_tickets WHERE id = $1', [id]);

            const allFiles = [
                ...messagesRes.rows.map(m => m.image_url),
                ...ticketRes.rows.map(t => t.image_url)
            ];

            deleteTicketFiles(allFiles);

            // 2. Clear messages and image URLs in DB
            await query(`UPDATE support_tickets SET message = 'PURGED', image_url = NULL WHERE id = $1`, [id]);
            await query(`UPDATE ticket_messages SET message = 'PURGED', image_url = NULL WHERE ticket_id = $1`, [id]);
        }

        await query('COMMIT');

        // Push notification to user when admin replies
        if (isAdmin && (message || file) && ticket.user_id) {
            try {
                const userRes = await query('SELECT expo_push_token FROM users WHERE id = $1', [ticket.user_id]);
                const pushToken = userRes.rows[0]?.expo_push_token;
                const statusLabel = newStatus === 'RESOLVED' ? 'Resolved' : newStatus === 'REJECTED' ? 'Rejected' : 'Open';
                if (pushToken) {
                    await sendExpoPushNotification(
                        pushToken,
                        `Support Ticket #ATH-${id} Updated`,
                        `Status: ${statusLabel} — Our team has replied to your ticket.`,
                        { ticketId: id, status: newStatus }
                    );
                }
            } catch (pushErr) {
                console.error('Push notification failed (non-fatal):', pushErr);
            }
        }

        // Real-time broadcast
        if (message || file) {
            const resultMessage = insertedMessage || {
                id: Date.now(),
                ticket_id: id,
                sender_id: isAdmin ? null : user.id,
                is_admin: isAdmin,
                message: message || '',
                image_url: file ? file.filename : null,
                created_at: new Date()
            };
            SupportBroadcaster.broadcastMessage(id as string, resultMessage);
        }

        res.json({ message: 'Reply sent successfully', newStatus });
    } catch (error: any) {
        await query('ROLLBACK');
        console.error('Reply Ticket Error:', error);
        res.status(500).json({ message: error.message || 'Failed to reply' });
    }
};
