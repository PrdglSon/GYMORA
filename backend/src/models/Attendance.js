import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

export const CHECKIN_METHODS = ['Mobile App', 'QR Kiosk', 'Front Desk'];

const schema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true },
    attendeeType: { type: String, enum: ['Member', 'Walk-in'], required: true },
    member: { type: ObjectId, ref: 'Member' },
    walkInGuest: { type: ObjectId, ref: 'WalkInGuest' },
    name: String,
    date: { type: Date, required: true },
    timeIn: { type: Date, required: true },
    timeOut: Date,
    method: { type: String, enum: CHECKIN_METHODS, required: true },
    status: { type: String, enum: ['Checked In', 'Checked Out', 'Auto Checked Out'], default: 'Checked In' },
    payment: { type: ObjectId, ref: 'Payment' },
    recordedBy: { type: ObjectId, ref: 'StaffAdmin' },
  },
  { timestamps: true }
);
schema.index({ gym: 1, timeIn: -1 });
schema.index({ gym: 1, member: 1, timeIn: -1 });

export default mongoose.model('Attendance', schema);
