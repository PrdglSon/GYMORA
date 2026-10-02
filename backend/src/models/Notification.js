import mongoose from 'mongoose';

export const RECIPIENT_MODELS = ['Member', 'Coach', 'StaffAdmin'];

const schema = new mongoose.Schema(
  {
    gym: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', index: true },
    recipientType: { type: String, enum: RECIPIENT_MODELS, required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, refPath: 'recipientType', required: true },
    title: { type: String, required: true },
    message: String,
    notificationType: { type: String, default: 'General' },
    link: String,
    dateSent: { type: Date, default: Date.now },
    status: { type: String, enum: ['Unread', 'Read'], default: 'Unread' },
  },
  { timestamps: true }
);
schema.index({ recipient: 1, dateSent: -1 });

export default mongoose.model('Notification', schema);
