import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

export const EXPENSE_CATEGORIES = ['Utilities (electricity, water, internet)', 'Rent', 'Salaries and wages', 'Supplies (water, cleaning, toiletries)', 'Equipment and repairs', 'Products for resale', 'Marketing', 'Other'];

const schema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true, index: true },
    date: { type: Date, required: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, default: 'Other' },
    description: { type: String, required: true, trim: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 0 },
    paidWith: { type: String, enum: ['Cash', 'GCash', 'Bank transfer', 'Card', 'Other'], default: 'Cash' },
    recordedBy: { type: ObjectId, ref: 'StaffAdmin' },
    recordedByName: String,
  },
  { timestamps: true }
);
schema.index({ gym: 1, date: -1 });

export default mongoose.model('Expense', schema);
