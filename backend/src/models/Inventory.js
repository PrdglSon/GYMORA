import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    quantity: { type: Number, required: true },
    stockAfter: Number,
    status: { type: String, enum: ['Initial', 'Restock', 'Sale', 'Adjustment', 'Void'], required: true },
    note: String,
    posTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'PosTransaction' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffAdmin' },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model('Inventory', schema);
