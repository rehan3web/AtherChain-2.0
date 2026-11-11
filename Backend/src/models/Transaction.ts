
import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
    userId: string;
    txHash: string;
    type: string;
    amount: string;
    status: string;
    metadata?: any;
    fromAddress?: string;
    toAddress?: string;
    fee?: string;
    createdAt: Date;
}

const TransactionSchema: Schema = new Schema({
    userId: { type: String, required: true, index: true },
    txHash: { type: String, required: true, index: true },
    type: { type: String, required: true },
    amount: { type: String, required: true },
    status: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    fromAddress: { type: String },
    toAddress: { type: String },
    fee: { type: String },
    createdAt: { type: Date, default: Date.now, index: true }
});

// Compound unique index for txHash per user to allow sender/receiver to share hash
TransactionSchema.index({ txHash: 1, userId: 1 }, { unique: true });

// Compound index for user transactions sorted by date
TransactionSchema.index({ userId: 1, type: 1, createdAt: -1 });
TransactionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
