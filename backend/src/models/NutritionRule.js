import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    goal: { type: String, required: true },
    bmiMin: { type: Number, default: 0 },
    bmiMax: { type: Number, default: 100 },
    title: String,
    tips: { type: [String], default: [] },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  },
  { timestamps: true }
);

export default mongoose.model('NutritionRule', schema);
