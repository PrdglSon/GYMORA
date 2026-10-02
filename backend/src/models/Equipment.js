import mongoose from 'mongoose';

export const EQUIPMENT_STATUS = ['Operational', 'Needs Maintenance', 'Under Repair', 'Out of Order'];

const schema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    equipmentName: { type: String, required: true },
    code: String,
    category: String,
    location: String,
    status: { type: String, enum: EQUIPMENT_STATUS, default: 'Operational' },
    purchaseDate: Date,
    lastServicedAt: Date,
    nextServiceAt: Date,
    notes: String,
    maintenanceLog: [{ date: { type: Date, default: Date.now }, action: String, byName: String }],
  },
  { timestamps: true }
);

export default mongoose.model('Equipment', schema);
