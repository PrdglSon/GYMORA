import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    sku: { type: String, required: true },
    productName: { type: String, required: true, trim: true },
    brand: String,
    category: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    cost: { type: Number, min: 0 },
    stockQuantity: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 5, min: 0 },
    imageUrl: String,
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  },
  { timestamps: true }
);
schema.index({ gym: 1, sku: 1 }, { unique: true });

export default mongoose.model('Product', schema);
