import mongoose from 'mongoose';
import Transaction from '../models/Transaction';
import { env } from '../config/env';
import dotenv from 'dotenv';

dotenv.config();

async function verify() {
    try {
        console.log('Connecting to MongoDB...');
        // Use the connection string from env or a default local one
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/at_test';
        await mongoose.connect(mongoUri);
        console.log('Connected.');

        // 1. Success case: Same hash, different users
        console.log('Testing same hash, different users...');
        const sharedHash = 'ATH_TX_TEST_COLLISION_' + Date.now();

        await Transaction.create({
            userId: 'user_a',
            txHash: sharedHash,
            type: 'send',
            amount: '10',
            status: 'completed'
        });
        console.log('Sender transaction created.');

        await Transaction.create({
            userId: 'user_b',
            txHash: sharedHash,
            type: 'receive',
            amount: '10',
            status: 'completed'
        });
        console.log('Receiver transaction created successfully (Collision allowed for different users).');

        // 2. Failure case: Same hash, Same user (Double entry protection)
        console.log('Testing same hash, same user (should fail)...');
        try {
            await Transaction.create({
                userId: 'user_a',
                txHash: sharedHash,
                type: 'send',
                amount: '10',
                status: 'completed'
            });
            console.error('FAILED: Should have blocked duplicate hash for SAME user.');
        } catch (err: any) {
            if (err.code === 11000) {
                console.log('SUCCESS: Prevented duplicate hash for same user.');
            } else {
                console.error('Unexpected error:', err);
            }
        }

        // Cleanup test data
        await Transaction.deleteMany({ txHash: sharedHash });
        console.log('Test data cleaned up.');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

verify();
