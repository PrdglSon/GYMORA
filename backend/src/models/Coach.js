import mongoose from 'mongoose';
import { accountFields, applyAccount } from './account.js';

export const AVAILABILITY = ['Available', 'In Session', 'Unavailable'];

const schema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    ...accountFields,
    experience: { type: Number, default: 0, min: 0 },
    certification: String,
    bio: String,
    availabilityStatus: { type: String, enum: AVAILABILITY, default: 'Unavailable' },
    availabilityUpdatedAt: Date,
    activeStatus: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    status: { type: String, enum: ['active', 'inactive', 'pending'], default: 'active' },
  },
  { timestamps: true }
);
schema.index({ gym: 1, email: 1 }, { unique: true });
schema.virtual('specializationDocs', { ref: 'CoachSpecialization', localField: '_id', foreignField: 'coach' });
applyAccount(schema);

export default mongoose.model('Coach', schema);
