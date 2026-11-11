const mongoose = require('mongoose');
require('dotenv').config();

async function dropIndex() {
    try {
        console.log('Connecting to MongoDB...');
        const mongoUri = process.env.MONGO_URI;
        await mongoose.connect(mongoUri);
        console.log('Connected.');

        const db = mongoose.connection.db;
        const collection = db.collection('transactions');

        console.log('Checking existing indexes...');
        const indexes = await collection.indexes();
        console.log('Current indexes:', JSON.stringify(indexes, null, 2));

        const hasTxHashUnique = indexes.some(idx => idx.name === 'txHash_1');

        if (hasTxHashUnique) {
            console.log('Attempting to drop index txHash_1...');
            await collection.dropIndex('txHash_1');
            console.log('Index txHash_1 dropped successfully!');
        } else {
            console.log('Index txHash_1 not found.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

dropIndex();
