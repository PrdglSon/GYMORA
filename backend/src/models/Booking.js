import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

export const BOOKING_STATUS = ['Pending', 'Approved', 'Declined', 'Cancelled', 'Completed', 'No-show', 'Expired'];
export const OPEN_BOOKING = ['Pending', 'Approved'];

const schema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true, index: true },
    bookingNo: { type: String, required: true },
    member: { type: ObjectId, ref: 'Member', required: true },
    coach: { type: ObjectId, ref: 'Coach', required: true },
    sessionDate: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    focus: { type: String, trim: true, maxlength: 120 },
    notes: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: BOOKING_STATUS, default: 'Pending' },
    responseNote: { type: String, trim: true, maxlength: 300 },
    decidedBy: { type: String, enum: ['Coach', 'StaffAdmin'] },
    decidedAt: Date,
    cancelledBy: { type: String, enum: ['Member', 'Coach', 'StaffAdmin'] },
    cancelReason: { type: String, trim: true, maxlength: 300 },
    cancelledAt: Date,
    completedAt: Date,
  },
  { timestamps: true }
);
schema.index({ gym: 1, coach: 1, sessionDate: 1 });
schema.index({ gym: 1, member: 1, sessionDate: -1 });

export default mongoose.model('Booking', schema);
