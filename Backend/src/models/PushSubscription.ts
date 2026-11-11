import { query } from '../db/postgres';

export class PushSubscriptionModel {
    static async createOrUpdate(userId: string, subscription: any) {
        return await query(
            `INSERT INTO push_subscriptions (user_id, subscription)
             VALUES ($1, $2)
             ON CONFLICT (user_id) DO UPDATE SET subscription = $2
             RETURNING id`,
            [userId, JSON.stringify(subscription)]
        );
    }

    static async findByUserId(userId: string) {
        const res = await query('SELECT * FROM push_subscriptions WHERE user_id = $1', [userId]);
        return res.rows[0];
    }

    static async deleteByUserId(userId: string) {
        return await query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);
    }

    static async getAll() {
        const res = await query('SELECT * FROM push_subscriptions');
        return res.rows;
    }
}
