import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    program: { type: mongoose.Schema.Types.ObjectId, ref: 'FitnessProgram', required: true },
    enrollmentDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['Active', 'Dropped', 'Completed'], default: 'Active' },
    droppedAt: Date,
  },
  { timestamps: true }
);
schema.index({ program: 1, member: 1 }, { unique: true });

export default mongoose.model('Enrollment', schema);
