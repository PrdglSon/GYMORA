import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

export const INCIDENT_CATEGORIES = ['Equipment', 'Facility', 'Billing', 'Coach', 'Safety', 'Feedback', 'Other'];

const schema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true, index: true },
    reportNo: { type: String, required: true },
    reporterType: { type: String, enum: ['Member', 'Coach'], required: true },
    reporter: { type: ObjectId, refPath: 'reporterType', required: true },
    member: { type: ObjectId, ref: 'Member' },
    reporterName: String,
    subject: { type: String, required: true },
    description: String,
    category: { type: String, enum: INCIDENT_CATEGORIES, default: 'Other' },
    equipment: { type: ObjectId, ref: 'Equipment' },
    priority: { type: String, enum: ['Low', 'Normal', 'High'], default: 'Normal' },
    dateReported: { type: Date, default: Date.now },
    status: { type: String, enum: ['Open', 'In Progress', 'Resolved', 'Closed'], default: 'Open' },
    resolution: String,
    resolvedAt: Date,
    history: [{ at: { type: Date, default: Date.now }, byName: String, status: String, note: String }],
  },
  { timestamps: true }
);
schema.index({ gym: 1, reportNo: 1 }, { unique: true });

export default mongoose.model('IncidentReport', schema);
