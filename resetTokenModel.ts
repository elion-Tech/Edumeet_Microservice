import mongoose, { Schema, Document } from 'mongoose';

export interface IResetToken extends Document {
    userId: string;
    token: string;
    createdAt: Date;
}

const ResetTokenSchema: Schema = new Schema({
    userId: { type: String, required: true, ref: 'User' },
    token: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 3600 } // Token expires in 1 hour
});

export default mongoose.model<IResetToken>('ResetToken', ResetTokenSchema);