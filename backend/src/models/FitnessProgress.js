import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const schema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true, index: true },
    member: { type: ObjectId, ref: 'Member', required: true, index: true },
    program: { type: ObjectId, ref: 'FitnessProgram' },
    coach: { type: ObjectId, ref: 'Coach' },
    recordDate: { type: Date, default: Date.now },
    weight: { type: Number, min: 20, max: 400 },
    bodyFat: { type: Number, min: 2, max: 70 },
    bmi: Number,
    remarks: String,
    recordedByType: { type: String, enum: ['Member', 'Coach', 'StaffAdmin'] },
    recordedBy: { type: ObjectId, refPath: 'recordedByType' },
  },
  { timestamps: true }
);

export default mongoose.model('FitnessProgress', schema);
