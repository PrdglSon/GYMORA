import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    coach: { type: mongoose.Schema.Types.ObjectId, ref: 'Coach', required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    senderType: { type: String, enum: ['Coach', 'Member'], required: true },
    content: { type: String, required: true, maxlength: 1000 },
    readAt: Date,
  },
  { timestamps: true }
);
schema.index({ coach: 1, member: 1, createdAt: 1 });

export default mongoose.model('Message', schema);
