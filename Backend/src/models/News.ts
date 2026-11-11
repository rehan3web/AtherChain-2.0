
import mongoose, { Schema, Document } from 'mongoose';

export interface INews extends Document {
    bucket: string;
    title: string;
    description: string;
    imageUrl?: string;
    updatedAt: Date;
    createdBy: string;
    createdAt: Date;
}

const NewsSchema: Schema = new Schema({
    bucket: { type: String, default: 'global', index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String },
    updatedAt: { type: Date, default: Date.now },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, index: true } // Secondary index for sorting
}, { timestamps: true }); // Mongoose adds createdAt/updatedAt automatically but we want to be explicit to match old schema if needed, but timestamps: true is better.

// We can rely on Mongoose timestamps but the old schema had explicit fields.
// Let's use Mongoose timestamps option but ensure mapped fields exist.
// Actually, `timestamps: true` creates `createdAt` and `updatedAt`.
// We should just use that.

export default mongoose.model<INews>('News', NewsSchema);
