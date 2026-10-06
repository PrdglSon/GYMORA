import mongoose from 'mongoose';
import { applyContactRules } from '../utils/validators.js';

const schema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    inquiryNo: { type: String, required: true },
    inquiryType: { type: String, enum: ['Inquiry', 'Membership', 'Coach Application', 'Support Request'], default: 'Inquiry' },
    senderType: { type: String, enum: ['Guest', 'Member', 'Coach'], default: 'Guest' },
    sender: { type: mongoose.Schema.Types.ObjectId, refPath: 'senderModel' },
    senderModel: { type: String, enum: ['Member', 'Coach'] },
    fullName: { type: String, required: true },
    contact: String,
    subject: { type: String, required: true },
    message: String,
    status: { type: String, enum: ['Open', 'In Progress', 'Resolved', 'Closed'], default: 'Open' },
    response: String,
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffAdmin' },
    respondedAt: Date,
  },
  { timestamps: true }
);
schema.index({ gym: 1, inquiryNo: 1 }, { unique: true });

applyContactRules(schema, { phones: [], names: ['fullName'] });

export default mongoose.model('Inquiry', schema);
