import mongoose from 'mongoose';
import { emitToStaff } from '../utils/socket.js';

const { ObjectId } = mongoose.Schema.Types;

export const PAYMENT_METHODS = ['Cash', 'GCash', 'Card', 'Online', 'Other', 'Unpaid'];

const schema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true, index: true },
    receiptNo: { type: String, required: true },
    paymentType: { type: String, enum: ['Membership', 'Walk-in', 'Other'], required: true },
    membership: { type: ObjectId, ref: 'Membership' },
    member: { type: ObjectId, ref: 'Member' },
    walkInGuest: { type: ObjectId, ref: 'WalkInGuest' },
    posTransaction: { type: ObjectId, ref: 'PosTransaction' },
    payerName: { type: String, required: true },
    description: String,
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'Cash' },
    paymentDate: Date,
    referenceNumber: String,
    online: {
      provider: String,
      checkoutId: String,
      checkoutUrl: String,
      startedAt: Date,
      channel: String,
      providerPaymentId: String,
      paidAt: Date,
    },
    status: { type: String, enum: ['Paid', 'Unpaid', 'Void'], default: 'Paid' },
    recordedBy: { type: ObjectId, ref: 'StaffAdmin' },
  },
  { timestamps: true }
);
schema.index({ gym: 1, receiptNo: 1 }, { unique: true });
schema.index({ gym: 1, paymentDate: -1 });

schema.post('save', (doc) => emitToStaff(doc.gym, 'payments:update', {}));

export default mongoose.model('Payment', schema);
