const mongoose = require('mongoose');
require('dotenv').config();

async function listAll() {
    try {
        console.log('Connecting to MongoDB...');
        const mongoUri = process.env.MONGO_URI;
        await mongoose.connect(mongoUri);
        console.log('Connected.');

        const db = mongoose.connection.db;
        console.log('Current Database:', db.databaseName);

        const collections = await db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));

        for (const col of collections) {
            console.log(`Indexes for ${col.name}:`);
            const indexes = await db.collection(col.name).indexes();
            console.log(JSON.stringify(indexes, null, 2));
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

listAll();
