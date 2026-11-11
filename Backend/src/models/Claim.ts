
import mongoose, { Schema, Document } from 'mongoose';

export interface IClaim extends Document {
    userId: string;
    walletAddress: string;
    amount: string;
    status: 'pending' | 'processing' | 'sent' | 'failed';
    txHash?: string;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}

const ClaimSchema: Schema = new Schema({
    userId: { type: String, required: true, index: true },
    walletAddress: { type: String, required: true },
    amount: { type: String, required: true, default: '0.1' },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'processing', 'sent', 'failed'],
        default: 'pending'
    },
    txHash: { type: String },
    error: { type: String }
}, {
    timestamps: true
});

// Compound index for user claims
ClaimSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IClaim>('Claim', ClaimSchema);
