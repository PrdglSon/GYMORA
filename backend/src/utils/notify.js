import mongoose from 'mongoose';
import { Notification, Gym, StaffAdmin, Member, Coach } from '../models/index.js';
import { emitToAccount } from './socket.js';
import { sendEmail } from './email.js';

const MODELS = { Member, Coach, StaffAdmin };

export async function notify(recipients, { gym, type = 'General', title, message, link, email = false }) {
  const list = (Array.isArray(recipients) ? recipients : [recipients]).filter((r) => r && r.id);
  if (!list.length) return [];
  const docs = await Notification.insertMany(list.map((r) => ({ gym, recipientType: r.type, recipient: r.id, title, message, link, notificationType: type })));
  docs.forEach((n) => emitToAccount(n.recipientType, n.recipient, 'notification', n));
  if (email) {
    const g = gym ? await Gym.findById(gym).select('name settings.emailNotifications') : null;
    if (!g || g.settings?.emailNotifications !== false) {
      for (const type of Object.keys(MODELS)) {
        const ids = list.filter((r) => r.type === type).map((r) => new mongoose.Types.ObjectId(String(r.id)));
        if (!ids.length) continue;
        const people = await MODELS[type].find({ _id: { $in: ids } }).select('email');
        await Promise.all(people.map((p) => sendEmail({ to: p.email, subject: `${g ? `${g.name}: ` : ''}${title}`, text: message })));
      }
    }
  }
  return docs;
}

export const toMember = (id) => ({ type: 'Member', id: id?._id || id });
export const toCoach = (id) => ({ type: 'Coach', id: id?._id || id });
export const toStaff = (id) => ({ type: 'StaffAdmin', id: id?._id || id });

export async function notifyStaff(gym, payload, roles = ['admin', 'receptionist']) {
  const staff = await StaffAdmin.find({ gym, role: { $in: roles }, status: 'active' }).select('_id');
  return notify(staff.map(toStaff), { gym, ...payload });
}

export async function notifyAllMembers(gym, payload) {
  const members = await Member.find({ gym, status: 'active' }).select('_id');
  return notify(members.map(toMember), { gym, ...payload });
}

export async function notifyAllCoaches(gym, payload) {
  const coaches = await Coach.find({ gym, status: 'active' }).select('_id');
  return notify(coaches.map(toCoach), { gym, ...payload });
}
