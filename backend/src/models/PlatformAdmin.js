import mongoose from 'mongoose';
import { accountFields, applyAccount } from './account.js';

const schema = new mongoose.Schema({ ...accountFields, status: { type: String, enum: ['active', 'inactive'], default: 'active' } }, { timestamps: true });
schema.index({ email: 1 }, { unique: true });
applyAccount(schema);

export default mongoose.model('PlatformAdmin', schema);
