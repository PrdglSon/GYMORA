import mongoose from 'mongoose';
import { accountFields, applyAccount } from './account.js';

export const STAFF_ROLES = ['admin', 'receptionist'];

const schema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    ...accountFields,
    role: { type: String, enum: STAFF_ROLES, required: true },
    status: { type: String, enum: ['active', 'inactive', 'pending'], default: 'active' },
  },
  { timestamps: true }
);
schema.index({ gym: 1, email: 1 }, { unique: true });
applyAccount(schema);

export default mongoose.model('StaffAdmin', schema);
