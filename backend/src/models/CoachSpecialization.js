import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    coach: { type: mongoose.Schema.Types.ObjectId, ref: 'Coach', required: true, index: true },
    specializationName: { type: String, required: true, trim: true },
    description: String,
  },
  { timestamps: true }
);
schema.index({ coach: 1, specializationName: 1 }, { unique: true });

export default mongoose.model('CoachSpecialization', schema);
