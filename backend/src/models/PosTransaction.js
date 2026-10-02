import mongoose from 'mongoose';
import { emitToStaff } from '../utils/socket.js';

const { ObjectId } = mongoose.Schema.Types;

const schema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true, index: true },
    transactionNo: { type: String, required: true },
    member: { type: ObjectId, ref: 'Member' },
    customerName: { type: String, default: 'Walk-in' },
    transactionDate: { type: Date, default: Date.now },
    subtotal: Number,
    discountLabel: String,
    discountRate: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    productAmount: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ['Cash', 'GCash', 'Card', 'Other'], required: true },
    referenceNumber: String,
    amountTendered: Number,
    change: Number,
    status: { type: String, enum: ['Completed', 'Void'], default: 'Completed' },
    cashier: { type: ObjectId, ref: 'StaffAdmin' },
  },
  { timestamps: true }
);
schema.index({ gym: 1, transactionNo: 1 }, { unique: true });
schema.index({ gym: 1, transactionDate: -1 });

schema.post('save', (doc) => emitToStaff(doc.gym, 'payments:update', {}));

export default mongoose.model('PosTransaction', schema);
