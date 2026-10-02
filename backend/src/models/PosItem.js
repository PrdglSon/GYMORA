import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const schema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true, index: true },
    transaction: { type: ObjectId, ref: 'PosTransaction', required: true, index: true },
    itemType: { type: String, enum: ['Product', 'Walk-in Pass', 'Membership'], required: true },
    product: { type: ObjectId, ref: 'Product' },
    plan: { type: ObjectId, ref: 'MembershipPlan' },
    itemName: String,
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
  },
  { timestamps: true }
);

export default mongoose.model('PosItem', schema);
