import webpush from 'web-push';
import dotenv from 'dotenv';

dotenv.config();

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const adminEmail = process.env.ADMIN_EMAIL || 'admin@ather.network';

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(
        `mailto:${adminEmail}`,
        vapidPublicKey,
        vapidPrivateKey
    );
}

export class NotificationService {
    static async sendPushNotification(subscription: any, payload: { title: string; body: string; icon?: string; data?: any }) {
        try {
            await webpush.sendNotification(
                subscription,
                JSON.stringify(payload)
            );
            return true;
        } catch (error: any) {
            console.error('Push Notification Error:', error);
            if (error.statusCode === 404 || error.statusCode === 410) {
                // Subscription has expired or is no longer valid
                return false;
            }
            throw error;
        }
    }
}
