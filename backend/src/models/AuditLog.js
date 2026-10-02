import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', index: true },
    actorType: String,
    actor: mongoose.Schema.Types.ObjectId,
    actorName: String,
    role: String,
    module: { type: String, required: true },
    action: { type: String, required: true },
    meta: mongoose.Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: true }
);
schema.index({ gym: 1, createdAt: -1 });

export default mongoose.model('AuditLog', schema);
