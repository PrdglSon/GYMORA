import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    programName: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    description: String,
    coach: { type: mongoose.Schema.Types.ObjectId, ref: 'Coach' },
    schedule: String,
    capacity: { type: Number, default: 20, min: 1 },
    durationWeeks: Number,
    level: { type: String, enum: ['All Levels', 'Beginner', 'Intermediate', 'Advanced'], default: 'All Levels' },
    imageUrl: String,
    status: { type: String, enum: ['Active', 'Draft', 'Inactive'], default: 'Active' },
  },
  { timestamps: true }
);

export default mongoose.model('FitnessProgram', schema);
