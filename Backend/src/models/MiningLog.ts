
import mongoose, { Schema, Document } from 'mongoose';

export interface IMiningLog extends Document {
    userId: string;
    date: string;
    reward: string;
    timestamp: Date;
}

const MiningLogSchema: Schema = new Schema({
    userId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    reward: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

// Compound index for user mining history
MiningLogSchema.index({ userId: 1, date: -1 });

export default mongoose.model<IMiningLog>('MiningLog', MiningLogSchema);
