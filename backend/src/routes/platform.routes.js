import { Router } from 'express';
import mongoose from 'mongoose';
import { Gym, Member, StaffAdmin, Coach, AuditLog } from '../models/index.js';
import { protect, allow } from '../middleware/auth.js';
import { ah, notFound, ApiError } from '../utils/http.js';
import { sendEmail } from '../utils/email.js';
import { env } from '../config/env.js';

const r = Router();
r.use(protect, allow('platform'));

r.get('/gyms', ah(async (req, res) => {
  const gyms = await Gym.find().sort({ createdAt: -1 }).populate('owner', 'firstName lastName email phoneNumber').lean();
  const counts = await Member.aggregate([{ $group: { _id: '$gym', n: { $sum: 1 } } }]);
  const map = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  res.json(gyms.map(({ settings, ...g }) => ({ ...g, members: map[String(g._id)] || 0 })));
}));

r.patch('/gyms/:id', ah(async (req, res) => {
  const gym = await Gym.findById(req.params.id).populate('owner', 'email');
  if (!gym) throw notFound('Gym');
  if (['active', 'suspended', 'pending'].includes(req.body.status)) gym.status = req.body.status;
  await gym.save();
  if (req.body.status === 'active' && gym.owner) sendEmail({ to: gym.owner.email, subject: `${gym.name} is live on GYMORA`, text: `Your gym was approved. Log in at ${env.clientUrl}/admin/login` });
  res.json(gym);
}));

function gymModels() {
  return mongoose.modelNames().map((n) => mongoose.model(n)).filter((M) => M.modelName !== 'Gym' && M.schema.path('gym'));
}

r.get('/gyms/:id/export', ah(async (req, res) => {
  const gym = await Gym.findById(req.params.id).lean();
  if (!gym) throw notFound('Gym');
  const data = { exportedAt: new Date(), gym };
  for (const M of gymModels()) data[M.collection.collectionName] = await M.find({ gym: gym._id }).lean();
  res.setHeader('Content-Disposition', `attachment; filename="gymora-${gym.slug}-export.json"`);
  res.json(data);
}));

r.delete('/gyms/:id', ah(async (req, res) => {
  const gym = await Gym.findById(req.params.id);
  if (!gym) throw notFound('Gym');
  if (gym.status !== 'suspended') throw new ApiError(400, 'Suspend the gym first, then delete it.');
  if (req.body?.confirm !== gym.slug) throw new ApiError(400, `Type "${gym.slug}" to confirm.`);
  const removed = {};
  for (const M of gymModels()) {
    const { deletedCount } = await M.deleteMany({ gym: gym._id });
    if (deletedCount) removed[M.collection.collectionName] = deletedCount;
  }
  await Gym.deleteOne({ _id: gym._id });
  await AuditLog.create({ actorType: 'PlatformAdmin', actor: req.account._id, actorName: `${req.account.firstName} ${req.account.lastName}`, role: 'platform', module: 'Platform', action: `Deleted gym ${gym.name} (${gym.slug})`, meta: removed, ip: req.ip });
  res.json({ deleted: gym.name, removed });
}));

r.get('/stats', ah(async (req, res) => {
  const [gyms, active, pending, members, coaches, staff] = await Promise.all([Gym.countDocuments(), Gym.countDocuments({ status: 'active' }), Gym.countDocuments({ status: 'pending' }), Member.countDocuments(), Coach.countDocuments(), StaffAdmin.countDocuments()]);
  res.json({ gyms, active, pending, accounts: members + coaches + staff });
}));

export default r;
