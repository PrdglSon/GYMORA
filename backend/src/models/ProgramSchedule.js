import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    program: { type: mongoose.Schema.Types.ObjectId, ref: 'FitnessProgram', required: true, index: true },
    coach: { type: mongoose.Schema.Types.ObjectId, ref: 'Coach' },
    scheduleDate: { type: Date, required: true },
    startTime: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    endTime: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    status: { type: String, enum: ['Scheduled', 'Cancelled'], default: 'Scheduled' },
  },
  { timestamps: true }
);
schema.index({ gym: 1, scheduleDate: 1 });

export default mongoose.model('ProgramSchedule', schema);
