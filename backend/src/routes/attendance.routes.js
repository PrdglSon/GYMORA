import { Router } from 'express';
import { Attendance, Member } from '../models/index.js';
import { protect, allow, STAFF } from '../middleware/auth.js';
import { ah, ApiError, requireFields, notFound, escapeRegex } from '../utils/http.js';
import { toggleMemberVisit, recordWalkIn, walkInCheckout } from '../utils/attendance.js';
import { startOfDay, endOfDay, addDays, dayKey } from '../utils/dates.js';
import { audit } from '../utils/audit.js';
import { clientIdsOf } from './coaches.routes.js';

const r = Router();
r.use(protect);

function dayRange(dateStr) {
  const d = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  return { $gte: startOfDay(d), $lte: endOfDay(d) };
}

r.get('/me', allow('member'), ah(async (req, res) => {
  const visits = await Attendance.find({ member: req.member._id }).sort({ timeIn: -1 }).limit(120).lean();
  const open = visits.find((v) => !v.timeOut && new Date(v.timeIn) >= startOfDay());
  res.json({ visits, open: open || null });
}));

r.get('/busy', ah(async (req, res) => {
  const since = addDays(startOfDay(), -28);
  const tz = req.gym.settings.timezone;
  const [hist, today, now] = await Promise.all([
    Attendance.aggregate([{ $match: { gym: req.gymId, timeIn: { $gte: since, $lt: startOfDay() } } }, { $group: { _id: { $hour: { date: '$timeIn', timezone: tz } }, n: { $sum: 1 } } }]),
    Attendance.aggregate([{ $match: { gym: req.gymId, timeIn: { $gte: startOfDay() } } }, { $group: { _id: { $hour: { date: '$timeIn', timezone: tz } }, n: { $sum: 1 } } }]),
    Attendance.countDocuments({ gym: req.gymId, timeOut: null, timeIn: { $gte: startOfDay() } }),
  ]);
  const average = Array(24).fill(0);
  hist.forEach((h) => (average[h._id] = Math.round((h.n / 28) * 10) / 10));
  const todayCounts = Array(24).fill(0);
  today.forEach((h) => (todayCounts[h._id] = h.n));
  res.json({ average, today: todayCounts, inGymNow: now, openTime: req.gym.settings.openTime, closeTime: req.gym.settings.closeTime });
}));

r.get('/coach', allow('coach'), ah(async (req, res) => {
  const { ids } = await clientIdsOf(req.coach);
  const since = addDays(startOfDay(), -13);
  const visits = await Attendance.find({ gym: req.gymId, member: { $in: ids }, timeIn: { $gte: since } }).sort({ timeIn: -1 }).lean();
  const days = Array.from({ length: 14 }, (_, i) => dayKey(addDays(since, i)));
  res.json({ today: visits.filter((v) => new Date(v.timeIn) >= startOfDay()), days, series: days.map((k) => visits.filter((v) => dayKey(v.timeIn) === k).length), clientCount: ids.length });
}));

r.get('/', allow(...STAFF), ah(async (req, res) => {
  const filter = { gym: req.gymId, timeIn: dayRange(req.query.date) };
  if (req.query.attendeeType) filter.attendeeType = req.query.attendeeType;
  if (req.query.method) filter.method = req.query.method;
  if (req.query.q) filter.name = new RegExp(escapeRegex(req.query.q), 'i');
  res.json(await Attendance.find(filter).sort({ timeIn: -1 }).populate('member', 'memberCode').populate('payment', 'receiptNo status amount').lean());
}));

r.get('/stats', allow(...STAFF), ah(async (req, res) => {
  const today = startOfDay();
  const yesterday = addDays(today, -1);
  const [t, y, activeMembers] = await Promise.all([
    Attendance.find({ gym: req.gymId, timeIn: { $gte: today } }).lean(),
    Attendance.find({ gym: req.gymId, timeIn: { $gte: yesterday, $lt: today } }).lean(),
    Member.countDocuments({ gym: req.gymId, 'current.endDate': { $gte: today } }),
  ]);
  const count = (arr, type) => arr.filter((a) => !type || a.attendeeType === type).length;
  const methods = { 'QR Kiosk': 0, 'Front Desk': 0 };
  t.forEach((a) => (methods[a.method] = (methods[a.method] || 0) + 1));
  const hourly = Array(24).fill(0);
  t.forEach((a) => hourly[new Date(a.timeIn).getHours()]++);
  const unique = new Set(t.filter((a) => a.member).map((a) => String(a.member))).size;
  const since = addDays(today, -6);
  const week = await Attendance.find({ gym: req.gymId, timeIn: { $gte: since } }).select('attendeeType timeIn').lean();
  const days = Array.from({ length: 7 }, (_, i) => addDays(since, i));
  res.json({
    today: { members: count(t, 'Member'), walkins: count(t, 'Walk-in'), total: t.length, activeNow: t.filter((a) => !a.timeOut).length },
    yesterday: { members: count(y, 'Member'), walkins: count(y, 'Walk-in'), total: y.length },
    attendanceRate: activeMembers ? Math.round((unique / activeMembers) * 100) : 0,
    methods,
    hourly,
    week: days.map((d) => ({ date: dayKey(d), members: week.filter((a) => a.attendeeType === 'Member' && dayKey(a.timeIn) === dayKey(d)).length, walkins: week.filter((a) => a.attendeeType === 'Walk-in' && dayKey(a.timeIn) === dayKey(d)).length })),
  });
}));

r.post('/walkin', allow(...STAFF), ah(async (req, res) => {
  requireFields(req.body, ['fullName']);
  const result = await recordWalkIn({ gym: req.gymId, settings: req.gym.settings, fullName: req.body.fullName, phoneNumber: req.body.phoneNumber, email: req.body.email, method: req.body.method || 'Cash', referenceNumber: req.body.referenceNumber, paid: req.body.method !== 'Unpaid', recordedBy: req.account._id });
  audit(req, 'Attendance', `Walk-in ${req.body.fullName} tapped in (${result.payment.receiptNo})`);
  res.status(201).json(result);
}));

r.patch('/:id/checkout', allow(...STAFF), ah(async (req, res) => {
  const a = await Attendance.findOne({ _id: req.params.id, gym: req.gymId });
  if (!a) throw notFound('Visit');
  if (a.timeOut) throw new ApiError(409, 'Already tapped out.');
  await walkInCheckout(a);
  audit(req, 'Attendance', `Tapped out ${a.name}`);
  res.json(a);
}));

export default r;
