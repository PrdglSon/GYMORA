import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const schema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true, index: true },
    member: { type: ObjectId, ref: 'Member', required: true, index: true },
    plan: { type: ObjectId, ref: 'MembershipPlan', required: true },
    planName: String,
    price: Number,
    startDate: Date,
    endDate: Date,
    status: { type: String, enum: ['Pending', 'Active', 'Cancelled'], default: 'Pending' },
    createdBy: { type: ObjectId, ref: 'StaffAdmin' },
  },
  { timestamps: true }
);

export default mongoose.model('Membership', schema);
