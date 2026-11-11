import { NotificationService } from '../services/notificationService';
import { PushSubscriptionModel } from '../models/PushSubscription';
import pool from '../db/postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const testPush = async () => {
    try {
        console.log('🧪 Starting Push Notification Test...');

        // Get all subscriptions
        const subs = await PushSubscriptionModel.getAll();

        if (subs.length === 0) {
            console.log('⚠️ No push subscriptions found in database. Please subscribe from the frontend first.');
            process.exit(0);
        }

        console.log(`Found ${subs.length} subscriptions. Sending test notification to the first one...`);

        const sub = subs[0];
        const payload = {
            title: 'Test Notification 🚀',
            body: 'This is a test notification from the Ather Network backend.',
            icon: '/link.png',
            data: {
                url: '/dashboard/mining'
            }
        };

        const success = await NotificationService.sendPushNotification(sub.subscription, payload);

        if (success) {
            console.log('✅ Test notification sent successfully!');
        } else {
            console.log('❌ Failed to send test notification. Subscription might be invalid.');
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error);
    } finally {
        pool.end();
        process.exit(0);
    }
};

testPush();
