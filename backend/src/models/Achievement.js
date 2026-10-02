import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    badgeKey: { type: String, required: true },
    earnedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
schema.index({ member: 1, badgeKey: 1 }, { unique: true });

export default mongoose.model('Achievement', schema);
