import { Router } from 'express';
import { Booking, Coach, Member, ProgramSchedule, OPEN_BOOKING, BOOKING_STATUS, nextCode } from '../models/index.js';
import { protect, allow, STAFF } from '../middleware/auth.js';
import { ah, ApiError, requireFields, notFound, paging } from '../utils/http.js';
import { notify, notifyStaff, toMember, toCoach } from '../utils/notify.js';
import { canCheckIn } from '../utils/membership.js';
import { startOfDay, addDays, hhmmToMinutes } from '../utils/dates.js';
import { emitToAccount, emitToStaff } from '../utils/socket.js';
import { audit } from '../utils/audit.js';
import { fullName } from '../utils/format.js';

const r = Router();
r.use(protect);

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_DAYS_AHEAD = 60;

const parseDay = (v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) throw new ApiError(400, 'Choose a valid date.');
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Choose a valid date.');
  return d;
};
const startsAt = (b) => new Date(startOfDay(b.sessionDate).getTime() + hhmmToMinutes(b.startTime) * 60000);
const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
const label = (b) => `${new Date(b.sessionDate).toDateString()} ${b.startTime}–${b.endTime}`;

function dto(b) {
  const o = b.toObject ? b.toObject() : b;
  return {
    ...o,
    memberName: o.member?.firstName ? fullName(o.member) : o.member === null ? 'Deleted member' : undefined,
    memberCode: o.member?.memberCode,
    coachName: o.coach?.firstName ? fullName(o.coach) : o.coach === null ? 'Deleted coach' : undefined,
  };
}

async function loadBooking(req) {
  const b = await Booking.findOne({ _id: req.params.id, gym: req.gymId });
  if (!b) throw notFound('Booking');
  if (req.role === 'coach' && String(b.coach) !== String(req.account._id)) throw new ApiError(403, 'This booking is not yours.');
  if (req.role === 'member' && String(b.member) !== String(req.account._id)) throw new ApiError(403, 'This booking is not yours.');
  return b;
}

async function findConflict({ gym, coach, member, day, start, end, ignoreId }) {
  const s = hhmmToMinutes(start);
  const e = hhmmToMinutes(end);
  const base = { gym, sessionDate: day, status: { $in: OPEN_BOOKING }, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) };
  const coachBookings = await Booking.find({ ...base, coach }).lean();
  if (coachBookings.some((b) => overlaps(s, e, hhmmToMinutes(b.startTime), hhmmToMinutes(b.endTime)))) return 'The coach already has a session at that time. Pick another time.';
  if (member) {
    const mine = await Booking.find({ ...base, member }).lean();
    if (mine.some((b) => overlaps(s, e, hhmmToMinutes(b.startTime), hhmmToMinutes(b.endTime)))) return 'You already have a booking at that time.';
  }
  const classes = await ProgramSchedule.find({ gym, coach, scheduleDate: { $gte: day, $lt: addDays(day, 1) }, status: 'Scheduled' }).lean();
  if (classes.some((c) => overlaps(s, e, hhmmToMinutes(c.startTime), hhmmToMinutes(c.endTime)))) return 'The coach is teaching a class at that time. Pick another time.';
  return null;
}

function broadcast(b) {
  emitToAccount('Member', b.member, 'booking:update', { id: b._id });
  emitToAccount('Coach', b.coach, 'booking:update', { id: b._id });
  emitToStaff(b.gym, 'booking:update', { id: b._id });
}

r.get('/coach-day/:coachId', ah(async (req, res) => {
  const day = parseDay(req.query.date);
  const [bookings, classes] = await Promise.all([
    Booking.find({ gym: req.gymId, coach: req.params.coachId, sessionDate: day, status: { $in: OPEN_BOOKING } }).select('startTime endTime status').sort({ startTime: 1 }).lean(),
    ProgramSchedule.find({ gym: req.gymId, coach: req.params.coachId, scheduleDate: { $gte: day, $lt: addDays(day, 1) }, status: 'Scheduled' }).select('startTime endTime').lean(),
  ]);
  const busy = [
    ...bookings.map((b) => ({ startTime: b.startTime, endTime: b.endTime, kind: b.status === 'Approved' ? 'Booked' : 'Requested' })),
    ...classes.map((c) => ({ startTime: c.startTime, endTime: c.endTime, kind: 'Class' })),
  ].sort((a, b) => a.startTime.localeCompare(b.startTime));
  res.json({ openTime: req.gym.settings?.openTime || '06:00', closeTime: req.gym.settings?.closeTime || '22:00', busy });
}));

r.post('/', allow('member'), ah(async (req, res) => {
  requireFields(req.body, ['coachId', 'date', 'startTime', 'endTime']);
  const { startTime, endTime } = req.body;
  if (!HHMM.test(startTime) || !HHMM.test(endTime)) throw new ApiError(400, 'Choose a valid time.');
  if (hhmmToMinutes(endTime) <= hhmmToMinutes(startTime)) throw new ApiError(400, 'The end time must be after the start time.');
  if (hhmmToMinutes(endTime) - hhmmToMinutes(startTime) > 180) throw new ApiError(400, 'A session can be up to 3 hours.');
  const day = parseDay(req.body.date);
  const open = hhmmToMinutes(req.gym.settings?.openTime || '06:00');
  const close = hhmmToMinutes(req.gym.settings?.closeTime || '22:00');
  if (close > open && (hhmmToMinutes(startTime) < open || hhmmToMinutes(endTime) > close)) throw new ApiError(400, `Book within gym hours (${req.gym.settings.openTime} to ${req.gym.settings.closeTime}).`);
  const start = new Date(day.getTime() + hhmmToMinutes(startTime) * 60000);
  if (start <= new Date()) throw new ApiError(400, 'Choose a time in the future.');
  if (day > addDays(startOfDay(), MAX_DAYS_AHEAD)) throw new ApiError(400, `You can book up to ${MAX_DAYS_AHEAD} days ahead.`);
  if (!canCheckIn(req.member, req.gym.settings).ok) throw new ApiError(400, 'You need an active membership to book a coach.');
  const coach = await Coach.findOne({ _id: req.body.coachId, gym: req.gymId, status: 'active', activeStatus: 'Active' });
  if (!coach) throw new ApiError(400, 'This coach is not taking bookings.');
  const conflict = await findConflict({ gym: req.gymId, coach: coach._id, member: req.member._id, day, start: startTime, end: endTime });
  if (conflict) throw new ApiError(409, conflict);
  const b = await Booking.create({
    gym: req.gymId, bookingNo: await nextCode(req.gymId, 'booking'), member: req.member._id, coach: coach._id,
    sessionDate: day, startTime, endTime, focus: req.body.focus, notes: req.body.notes,
  });
  await notify(toCoach(coach), { gym: req.gymId, type: 'Booking', title: 'New booking request', message: `${fullName(req.member)} requested a session on ${label(b)}.`, link: '/coach/bookings', email: true });
  broadcast(b);
  res.status(201).json(b);
}));

r.get('/mine', allow('member'), ah(async (req, res) => {
  const list = await Booking.find({ gym: req.gymId, member: req.account._id }).populate('coach', 'firstName lastName avatarUrl').sort({ sessionDate: -1, startTime: -1 }).limit(100).lean();
  res.json(list.map(dto));
}));

r.get('/coach', allow('coach'), ah(async (req, res) => {
  const list = await Booking.find({ gym: req.gymId, coach: req.account._id }).populate('member', 'firstName lastName memberCode avatarUrl').sort({ sessionDate: 1, startTime: 1 }).limit(300).lean();
  res.json(list.map(dto));
}));

r.get('/', allow(...STAFF), ah(async (req, res) => {
  const { limit, skip } = paging(req.query, 200);
  const filter = { gym: req.gymId };
  if (req.query.status && BOOKING_STATUS.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.coach) filter.coach = req.query.coach;
  if (req.query.from || req.query.to) {
    filter.sessionDate = {};
    if (req.query.from) filter.sessionDate.$gte = parseDay(req.query.from);
    if (req.query.to) filter.sessionDate.$lte = parseDay(req.query.to);
  }
  const [items, total] = await Promise.all([
    Booking.find(filter).populate('member', 'firstName lastName memberCode').populate('coach', 'firstName lastName').sort({ sessionDate: -1, startTime: -1 }).skip(skip).limit(limit).lean(),
    Booking.countDocuments(filter),
  ]);
  res.json({ items: items.map(dto), total });
}));

r.get('/stats', allow(...STAFF), ah(async (req, res) => {
  const since = addDays(startOfDay(), -Number(req.query.days || 30));
  const match = { gym: req.gymId, sessionDate: { $gte: since } };
  const [byStatus, byCoach, upcoming] = await Promise.all([
    Booking.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Booking.aggregate([{ $match: match }, { $group: { _id: '$coach', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } }, approved: { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] } } } }, { $sort: { total: -1 } }]),
    Booking.countDocuments({ gym: req.gymId, status: 'Approved', sessionDate: { $gte: startOfDay() } }),
  ]);
  const coaches = await Coach.find({ _id: { $in: byCoach.map((c) => c._id) } }).select('firstName lastName').lean();
  const names = Object.fromEntries(coaches.map((c) => [String(c._id), fullName(c)]));
  const status = Object.fromEntries(BOOKING_STATUS.map((s) => [s, 0]));
  byStatus.forEach((s) => { status[s._id] = s.count; });
  const total = Object.values(status).reduce((a, b) => a + b, 0);
  res.json({ total, status, upcoming, byCoach: byCoach.map((c) => ({ coachId: c._id, coachName: names[String(c._id)] || 'Deleted coach', total: c.total, completed: c.completed, approved: c.approved })) });
}));

r.patch('/:id/approve', allow('coach', ...STAFF), ah(async (req, res) => {
  const b = await loadBooking(req);
  if (b.status !== 'Pending') throw new ApiError(400, 'Only pending bookings can be approved.');
  if (startsAt(b) <= new Date()) throw new ApiError(400, 'This session time has already passed.');
  const conflict = await findConflict({ gym: req.gymId, coach: b.coach, day: b.sessionDate, start: b.startTime, end: b.endTime, ignoreId: b._id });
  if (conflict) throw new ApiError(409, conflict.replace('Pick another time.', 'Decline this request instead.'));
  b.status = 'Approved';
  b.responseNote = req.body.note || undefined;
  b.decidedBy = req.accountType;
  b.decidedAt = new Date();
  await b.save();
  await notify(toMember(b.member), { gym: req.gymId, type: 'Booking', title: 'Booking approved', message: `Your session on ${label(b)} is confirmed.${b.responseNote ? ` Note: ${b.responseNote}` : ''}`, link: '/member/bookings', email: true });
  if (req.role !== 'coach') await notify(toCoach(b.coach), { gym: req.gymId, type: 'Booking', title: 'Booking approved by the front desk', message: `${label(b)} (${b.bookingNo})`, link: '/coach/bookings' });
  audit(req, 'Coach Booking', `Approved ${b.bookingNo}`);
  broadcast(b);
  res.json(b);
}));

r.patch('/:id/decline', allow('coach', ...STAFF), ah(async (req, res) => {
  const b = await loadBooking(req);
  if (b.status !== 'Pending') throw new ApiError(400, 'Only pending bookings can be declined.');
  b.status = 'Declined';
  b.responseNote = req.body.note || undefined;
  b.decidedBy = req.accountType;
  b.decidedAt = new Date();
  await b.save();
  await notify(toMember(b.member), { gym: req.gymId, type: 'Booking', title: 'Booking declined', message: `Your request for ${label(b)} was declined.${b.responseNote ? ` Reason: ${b.responseNote}` : ' Please choose another time.'}`, link: '/member/bookings', email: true });
  audit(req, 'Coach Booking', `Declined ${b.bookingNo}`);
  broadcast(b);
  res.json(b);
}));

r.patch('/:id/cancel', allow('member', 'coach', ...STAFF), ah(async (req, res) => {
  const b = await loadBooking(req);
  if (!OPEN_BOOKING.includes(b.status)) throw new ApiError(400, 'Only pending or approved bookings can be cancelled.');
  if (req.role === 'member' && startsAt(b) <= new Date()) throw new ApiError(400, 'This session has already started.');
  b.status = 'Cancelled';
  b.cancelledBy = req.accountType;
  b.cancelReason = req.body.reason || undefined;
  b.cancelledAt = new Date();
  await b.save();
  const msg = `${label(b)} (${b.bookingNo}) was cancelled${b.cancelReason ? `: ${b.cancelReason}` : '.'}`;
  if (req.role === 'member') await notify(toCoach(b.coach), { gym: req.gymId, type: 'Booking', title: 'Booking cancelled by member', message: msg, link: '/coach/bookings' });
  else await notify(toMember(b.member), { gym: req.gymId, type: 'Booking', title: 'Booking cancelled', message: msg, link: '/member/bookings', email: true });
  if (STAFF.includes(req.role)) await notify(toCoach(b.coach), { gym: req.gymId, type: 'Booking', title: 'Booking cancelled by the front desk', message: msg, link: '/coach/bookings' });
  audit(req, 'Coach Booking', `Cancelled ${b.bookingNo}`);
  broadcast(b);
  res.json(b);
}));

r.patch('/:id/complete', allow('coach', ...STAFF), ah(async (req, res) => {
  const b = await loadBooking(req);
  if (b.status !== 'Approved') throw new ApiError(400, 'Only approved bookings can be marked.');
  if (startsAt(b) > new Date()) throw new ApiError(400, 'You can mark the session after it starts.');
  const outcome = req.body.outcome === 'No-show' ? 'No-show' : 'Completed';
  b.status = outcome;
  b.responseNote = req.body.note || b.responseNote;
  b.completedAt = new Date();
  await b.save();
  if (outcome === 'Completed') await notify(toMember(b.member), { gym: req.gymId, type: 'Booking', title: 'Session completed', message: `Thanks for training on ${label(b)}!${req.body.note ? ` Coach note: ${req.body.note}` : ''}`, link: '/member/bookings' });
  audit(req, 'Coach Booking', `Marked ${b.bookingNo} as ${outcome}`);
  broadcast(b);
  res.json(b);
}));

export async function expireOldBookings(gymId) {
  const stale = await Booking.find({ gym: gymId, status: 'Pending', sessionDate: { $lt: startOfDay() } });
  for (const b of stale) {
    b.status = 'Expired';
    b.responseNote = 'No response before the session date.';
    await b.save();
  }
  return stale.length;
}

export default r;
