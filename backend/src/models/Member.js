import mongoose from 'mongoose';
import crypto from 'crypto';
import { accountFields, applyAccount } from './account.js';

const { ObjectId } = mongoose.Schema.Types;

export const FITNESS_GOALS = ['Weight Loss', 'Muscle Gain', 'Strength', 'General Fitness', 'Endurance', 'Flexibility'];

const schema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true, index: true },
    ...accountFields,
    memberCode: { type: String, required: true },
    qrToken: { type: String, default: () => crypto.randomBytes(12).toString('hex'), index: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other', 'Prefer not to say'], default: 'Prefer not to say' },
    birthdate: Date,
    address: String,
    emergencyContact: String,
    fitnessGoal: { type: String, enum: FITNESS_GOALS, default: 'General Fitness' },
    heightCm: { type: Number, min: 100, max: 250 },
    assignedCoach: { type: ObjectId, ref: 'Coach' },
    student: {
      isStudent: { type: Boolean, default: false },
      status: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
      school: String,
      idDocumentUrl: String,
      reviewedBy: { type: ObjectId, ref: 'StaffAdmin' },
      reviewedAt: Date,
      note: String,
    },
    current: {
      membership: { type: ObjectId, ref: 'Membership' },
      plan: { type: ObjectId, ref: 'MembershipPlan' },
      planName: String,
      startDate: Date,
      endDate: Date,
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    registrationDate: { type: Date, default: Date.now },
    lastVisitAt: Date,
    totalVisits: { type: Number, default: 0 },
    walkInGuest: { type: ObjectId, ref: 'WalkInGuest' },
  },
  { timestamps: true }
);
schema.index({ gym: 1, email: 1 }, { unique: true });
schema.index({ gym: 1, memberCode: 1 }, { unique: true });
applyAccount(schema);

export default mongoose.model('Member', schema);
