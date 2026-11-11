
import mongoose from 'mongoose';
import { env } from '../config/env';

export const connectMongo = async () => {
    try {
        await mongoose.connect(env.MONGO_URI);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        process.exit(1);
    }
};

export default mongoose;
