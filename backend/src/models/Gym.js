import mongoose from 'mongoose';
import { applyContactRules } from '../utils/validators.js';
import crypto from 'crypto';

const settingsSchema = new mongoose.Schema(
  {
    timezone: { type: String, default: 'Asia/Manila' },
    currency: { type: String, default: 'PHP' },
    openTime: { type: String, default: '06:00' },
    closeTime: { type: String, default: '22:00' },
    walkInFee: { type: Number, default: 150, min: 0 },
    graceDays: { type: Number, default: 3, min: 0 },
    inactiveDays: { type: Number, default: 14, min: 1 },
    nearExpiryDays: { type: Number, default: 7, min: 1 },
    allowOnlineSignup: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true },
    discounts: {
      type: [{ label: String, rate: Number }],
      default: [
        { label: 'Promo 10%', rate: 0.1 },
        { label: 'Student / Senior 20%', rate: 0.2 },
      ],
    },
    programCategories: { type: [String], default: ['HIIT', 'Strength Training', 'Yoga', 'Pilates', 'Zumba', 'Functional Fitness', 'Bodybuilding', 'Personal Coaching', 'Muay Thai'] },
    specializations: { type: [String], default: ['HIIT', 'Strength Training', 'Yoga', 'Pilates', 'Zumba', 'Functional Fitness', 'Bodybuilding', 'Personal Coaching', 'Muay Thai', 'Weight Loss', 'Mobility'] },
    kioskKey: { type: String, default: () => crypto.randomBytes(4).toString('hex').toUpperCase() },
  },
  { _id: false }
);

const gymSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    tagline: String,
    about: String,
    email: String,
    phoneNumber: String,
    address: String,
    city: String,
    country: { type: String, default: 'Philippines' },
    logoUrl: String,
    estimatedMembers: String,
    status: { type: String, enum: ['pending', 'active', 'suspended'], default: 'active' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffAdmin' },
    settings: { type: settingsSchema, default: () => ({}) },
    paymongo: {
      enabled: { type: Boolean, default: false },
      mode: { type: String, enum: ['test', 'live'] },
      last4: String,
      methods: { type: [String], default: ['card', 'gcash', 'paymaya'] },
      configuredAt: Date,
      secretKeyEnc: { type: String, select: false },
    },
  },
  { timestamps: true }
);

applyContactRules(gymSchema, { phones: ['phoneNumber'], names: [] });

export default mongoose.model('Gym', gymSchema);
