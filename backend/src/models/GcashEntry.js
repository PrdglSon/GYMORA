import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const schema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true, index: true },
    date: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    referenceNumber: { type: String, trim: true, maxlength: 60 },
    payerName: { type: String, trim: true, maxlength: 120 },
    note: { type: String, trim: true, maxlength: 200 },
    recordedBy: { type: ObjectId, ref: 'StaffAdmin' },
    recordedByName: String,
  },
  { timestamps: true }
);
schema.index({ gym: 1, date: -1 });

export default mongoose.model('GcashEntry', schema);
