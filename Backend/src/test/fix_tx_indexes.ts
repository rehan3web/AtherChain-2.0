import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixIndex() {
    try {
        console.log('Connecting to MongoDB...');
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/at_test';
        await mongoose.connect(mongoUri);
        console.log('Connected.');

        const db = mongoose.connection.db;
        if (!db) {
            throw new Error('Database connection not established');
        }
        const collection = db.collection('transactions');

        console.log('Checking existing indexes...');
        const indexes = await collection.indexes();
        console.log('Current indexes:', JSON.stringify(indexes, null, 2));

        const hasTxHashUnique = indexes.some(idx => idx.name === 'txHash_1' && idx.unique === true);

        if (hasTxHashUnique) {
            console.log('Dropping unique index txHash_1...');
            await collection.dropIndex('txHash_1');
            console.log('Index txHash_1 dropped.');
        } else {
            console.log('Unique index txHash_1 not found or already dropped.');
        }

        console.log('Ensuring new compound unique index { txHash: 1, userId: 1 }...');
        await collection.createIndex({ txHash: 1, userId: 1 }, { unique: true });
        console.log('New index created.');

        // Also add a non-unique index on txHash for fast lookups if needed
        await collection.createIndex({ txHash: 1 });
        console.log('Non-unique txHash index created.');

    } catch (error) {
        console.error('Error fixing index:', error);
    } finally {
        await mongoose.disconnect();
    }
}

fixIndex();
