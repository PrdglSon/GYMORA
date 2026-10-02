import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    fullName: { type: String, required: true, trim: true },
    phoneNumber: String,
    email: String,
    visits: { type: Number, default: 0 },
    lastVisitAt: Date,
    convertedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  },
  { timestamps: true }
);

export default mongoose.model('WalkInGuest', schema);
