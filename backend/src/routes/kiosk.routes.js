import { Router } from 'express';
import { Gym, Member } from '../models/index.js';
import { ah, ApiError, requireFields } from '../utils/http.js';
import { toggleMemberVisit, recordWalkIn } from '../utils/attendance.js';
import { notifyStaff } from '../utils/notify.js';
import { auditSystem } from '../utils/audit.js';

const r = Router();

const kioskGym = ah(async (req, res, next) => {
  const gym = await Gym.findOne({ slug: req.params.slug, status: 'active' });
  if (!gym) throw new ApiError(404, 'Gym not found.');
  if ((req.headers['x-kiosk-key'] || '').toUpperCase() !== gym.settings.kioskKey) throw new ApiError(403, 'Wrong kiosk key. Ask staff to unlock the kiosk.');
  req.kgym = gym;
  next();
});

r.get('/:slug/verify', kioskGym, (req, res) => res.json({ name: req.kgym.name, slug: req.kgym.slug, logoUrl: req.kgym.logoUrl, walkInFee: req.kgym.settings.walkInFee }));

r.post('/:slug/scan', kioskGym, ah(async (req, res) => {
  requireFields(req.body, ['code']);
  const code = String(req.body.code).trim();
  const member = await Member.findOne({ gym: req.kgym._id, $or: [{ qrToken: code }, { memberCode: code.toUpperCase() }] });
  if (!member || member.status !== 'active') return res.json({ ok: false, title: 'Not recognized', message: 'This QR code does not match an active member. Please see the front desk.' });
  const result = await toggleMemberVisit({ gym: req.kgym._id, settings: req.kgym.settings, member, method: 'QR Kiosk' });
  auditSystem(req.kgym._id, 'Attendance', `Kiosk tap-${result.action}: ${member.memberCode}`);
  res.json({ ok: result.ok, action: result.action, title: result.title, message: result.message });
}));

r.post('/:slug/walkin', kioskGym, ah(async (req, res) => {
  requireFields(req.body, ['fullName', 'phoneNumber']);
  const { payment } = await recordWalkIn({ gym: req.kgym._id, settings: req.kgym.settings, fullName: req.body.fullName, phoneNumber: req.body.phoneNumber, paid: false, via: 'QR Kiosk' });
  await notifyStaff(req.kgym._id, { type: 'Walk-in', title: 'Walk-in at kiosk', message: `${req.body.fullName}: collect ₱${payment.amount} (${payment.receiptNo})`, link: '/admin/billing' });
  res.status(201).json({ ok: true, title: `Welcome, ${String(req.body.fullName).split(' ')[0]}!`, message: `Please pay ₱${payment.amount} at the front desk.` });
}));

export default r;
