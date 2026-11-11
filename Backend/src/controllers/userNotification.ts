import { Request, Response } from 'express';
import pool from '../db/postgres';

export const getNotifications = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user?.id;

        // Fetch all broadcast notifications AND personal ones (if we add them later)
        // LEFT JOIN to check if read
        const query = `
            SELECT 
                n.id, 
                n.title, 
                n.message, 
                n.created_at,
                CASE WHEN nr.read_at IS NOT NULL THEN true ELSE false END as read
            FROM notifications n
            LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.user_id = $1
            WHERE n.type = 'broadcast'
            ORDER BY n.created_at DESC
            LIMIT 50
        `;

        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Get Notifications Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const markAsRead = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params;

        await pool.query(
            `INSERT INTO notification_reads (user_id, notification_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [userId, id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Mark Read Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
