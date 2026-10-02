import { Router } from 'express';
import { FitnessProgram, ProgramSchedule, Enrollment, Attendance, Member } from '../models/index.js';
import { protect, allow, STAFF } from '../middleware/auth.js';
import { ah, ApiError, requireFields, pick, notFound } from '../utils/http.js';
import { memberDTO, fullName } from '../utils/format.js';
import { notify, toMember, toCoach } from '../utils/notify.js';
import { membershipStatus } from '../utils/membership.js';
import { evaluateBadges } from '../utils/rules.js';
import { audit } from '../utils/audit.js';
import { startOfDay, addDays, atTime, hhmmToMinutes } from '../utils/dates.js';

const r = Router();
r.use(protect);
const FIELDS = ['programName', 'category', 'description', 'coach', 'schedule', 'capacity', 'durationWeeks', 'level', 'status', 'imageUrl'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function to12h(t) {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function sessionState(s) {
  if (s.status === 'Cancelled') return 'Cancelled';
  const now = new Date();
  const start = atTime(s.scheduleDate, s.startTime);
  const end = atTime(s.scheduleDate, s.endTime);
  if (now > end) return 'Completed';
  if (now >= start) return 'In Progress';
  return 'Upcoming';
}

async function enrolledCounts(gym) {
  const rows = await Enrollment.aggregate([{ $match: { gym, status: 'Active' } }, { $group: { _id: '$program', n: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((x) => [String(x._id), x.n]));
}

async function canEdit(req, program) {
  if (req.role === 'admin') return true;
  return req.role === 'coach' && String(program.coach) === String(req.coach._id);
}

async function generateSessions(program, { days = [], startTime, endTime, weeks = 4, startDate }) {
  if (!days.length || !startTime || !endTime) return 0;
  if (hhmmToMinutes(endTime) <= hhmmToMinutes(startTime)) throw new ApiError(400, 'End time must be after start time.');
  const from = startOfDay(startDate ? new Date(`${startDate}T00:00:00`) : new Date());
  const docs = [];
  for (let i = 0; i < Math.min(Number(weeks) || 4, 26) * 7; i++) {
    const d = addDays(from, i);
    if (days.map(Number).includes(d.getDay())) docs.push({ gym: program.gym, program: program._id, coach: program.coach, scheduleDate: d, startTime, endTime });
  }
  if (docs.length) await ProgramSchedule.insertMany(docs);
  program.schedule = `${[...new Set(days.map(Number))].sort().map((x) => DOW[x]).join('/')} · ${to12h(startTime)}–${to12h(endTime)}`;
  await program.save();
  return docs.length;
}

r.get('/', ah(async (req, res) => {
  const filter = { gym: req.gymId };
  if (req.role === 'member') filter.status = 'Active';
  if (req.query.mine === 'true' && req.role === 'coach') filter.coach = req.coach._id;
  const [programs, counts] = await Promise.all([FitnessProgram.find(filter).populate('coach', 'firstName lastName availabilityStatus').sort({ programName: 1 }).lean(), enrolledCounts(req.gymId)]);
  const mine = req.role === 'member' ? new Set((await Enrollment.find({ member: req.member._id, status: 'Active' }).select('program')).map((e) => String(e.program))) : new Set();
  const next = await ProgramSchedule.aggregate([{ $match: { gym: req.gymId, status: 'Scheduled', scheduleDate: { $gte: startOfDay() } } }, { $sort: { scheduleDate: 1, startTime: 1 } }, { $group: { _id: '$program', scheduleDate: { $first: '$scheduleDate' }, startTime: { $first: '$startTime' } } }]);
  const nextMap = Object.fromEntries(next.map((n) => [String(n._id), n]));
  res.json(programs.map((p) => ({ ...p, coachName: fullName(p.coach), coachAvailability: p.coach?.availabilityStatus, enrolled: counts[String(p._id)] || 0, isEnrolled: mine.has(String(p._id)), nextSession: nextMap[String(p._id)] || null })));
}));

r.get('/sessions', ah(async (req, res) => {
  const from = req.query.from ? startOfDay(new Date(`${req.query.from}T00:00:00`)) : startOfDay();
  const days = Math.min(parseInt(req.query.days, 10) || 7, 62);
  const filter = { gym: req.gymId, scheduleDate: { $gte: from, $lt: addDays(from, days) } };
  if (req.query.mine === 'true' && req.role === 'coach') filter.coach = req.coach._id;
  if (req.query.enrolled === 'true' && req.role === 'member') filter.program = { $in: (await Enrollment.find({ member: req.member._id, status: 'Active' })).map((e) => e.program) };
  if (req.query.program) filter.program = req.query.program;
  const [sessions, counts] = await Promise.all([ProgramSchedule.find(filter).populate('program', 'programName category capacity status').populate('coach', 'firstName lastName').sort({ scheduleDate: 1, startTime: 1 }).lean(), enrolledCounts(req.gymId)]);
  res.json(sessions.filter((s) => s.program && (req.role !== 'member' || s.program.status === 'Active')).map((s) => ({
    _id: s._id, programId: s.program._id, programName: s.program.programName, category: s.program.category, coachName: fullName(s.coach), coachId: s.coach?._id,
    scheduleDate: s.scheduleDate, startTime: s.startTime, endTime: s.endTime, start: atTime(s.scheduleDate, s.startTime), end: atTime(s.scheduleDate, s.endTime),
    durationMins: hhmmToMinutes(s.endTime) - hhmmToMinutes(s.startTime), enrolled: counts[String(s.program._id)] || 0, capacity: s.program.capacity, status: s.status, state: sessionState(s),
  })));
}));

r.post('/', allow('admin', 'coach'), ah(async (req, res) => {
  requireFields(req.body, ['programName', 'category']);
  const data = pick(req.body, FIELDS);
  if (req.role === 'coach') data.coach = req.coach._id;
  if (!data.coach) delete data.coach;
  const program = await FitnessProgram.create({ gym: req.gymId, ...data });
  const created = req.body.generate ? await generateSessions(program, req.body.generate) : 0;
  audit(req, 'Fitness Program Management', `Created program ${program.programName}${created ? ` with ${created} sessions` : ''}`);
  res.status(201).json({ program, sessionsCreated: created });
}));

r.patch('/schedules/:sid', allow('admin', 'coach'), ah(async (req, res) => {
  const s = await ProgramSchedule.findOne({ _id: req.params.sid, gym: req.gymId }).populate('program');
  if (!s) throw notFound('Session');
  if (!(await canEdit(req, s.program))) throw new ApiError(403, 'You can only edit your own sessions.');
  const wasCancelled = s.status === 'Cancelled';
  Object.assign(s, pick(req.body, ['scheduleDate', 'startTime', 'endTime', 'status']));
  await s.save();
  if (!wasCancelled && s.status === 'Cancelled') {
    const enr = await Enrollment.find({ program: s.program._id, status: 'Active' }).select('member');
    await notify(enr.map((e) => toMember(e.member)), { gym: req.gymId, type: 'Schedule', title: 'Session cancelled', message: `${s.program.programName} on ${new Date(s.scheduleDate).toDateString()} at ${to12h(s.startTime)} is cancelled.`, link: '/member/programs' });
  }
  audit(req, 'Fitness Program Management', `Updated a ${s.program.programName} session (${s.status})`);
  res.json(s);
}));

r.delete('/schedules/:sid', allow('admin', 'coach'), ah(async (req, res) => {
  const s = await ProgramSchedule.findOne({ _id: req.params.sid, gym: req.gymId }).populate('program');
  if (!s) throw notFound('Session');
  if (!(await canEdit(req, s.program))) throw new ApiError(403, 'You can only delete your own sessions.');
  await s.deleteOne();
  res.json({ ok: true });
}));

r.patch('/:id', allow('admin', 'coach'), ah(async (req, res) => {
  const p = await FitnessProgram.findOne({ _id: req.params.id, gym: req.gymId });
  if (!p) throw notFound('Program');
  if (!(await canEdit(req, p))) throw new ApiError(403, 'You can only edit your own programs.');
  const data = pick(req.body, FIELDS);
  if (req.role === 'coach') delete data.coach;
  if (data.coach === '' || data.coach === null) data.coach = undefined;
  if (data.capacity) {
    const n = await Enrollment.countDocuments({ program: p._id, status: 'Active' });
    if (data.capacity < n) throw new ApiError(400, `Capacity can't be below the ${n} members already enrolled.`);
  }
  Object.assign(p, data);
  await p.save();
  if (data.coach !== undefined) await ProgramSchedule.updateMany({ program: p._id, scheduleDate: { $gte: startOfDay() } }, { coach: p.coach });
  let created = 0;
  if (req.body.generate) {
    if (req.body.replaceUpcoming) await ProgramSchedule.deleteMany({ program: p._id, scheduleDate: { $gte: startOfDay() } });
    created = await generateSessions(p, req.body.generate);
    const enr = await Enrollment.find({ program: p._id, status: 'Active' }).select('member');
    await notify(enr.map((e) => toMember(e.member)), { gym: req.gymId, type: 'Schedule', title: 'Schedule update', message: `${p.programName} has a new schedule: ${p.schedule}.`, link: '/member/programs' });
  }
  audit(req, 'Fitness Program Management', `Edited program ${p.programName}${created ? ` and added ${created} sessions` : ''}`);
  res.json({ program: p, sessionsCreated: created });
}));

r.delete('/:id', allow('admin'), ah(async (req, res) => {
  const p = await FitnessProgram.findOne({ _id: req.params.id, gym: req.gymId });
  if (!p) throw notFound('Program');
  if (await Enrollment.exists({ program: p._id, status: 'Active' })) {
    p.status = 'Inactive';
    await p.save();
    audit(req, 'Fitness Program Management', `Set program ${p.programName} to Inactive`);
    return res.json({ ok: true, deactivated: true });
  }
  await ProgramSchedule.deleteMany({ program: p._id });
  await p.deleteOne();
  audit(req, 'Fitness Program Management', `Deleted program ${p.programName}`);
  res.json({ ok: true });
}));

r.get('/:id/roster', allow(...STAFF, 'coach'), ah(async (req, res) => {
  const p = await FitnessProgram.findOne({ _id: req.params.id, gym: req.gymId }).lean();
  if (!p) throw notFound('Program');
  const enr = await Enrollment.find({ program: p._id, status: 'Active' }).populate('member');
  const todays = await Attendance.find({ gym: req.gymId, timeIn: { $gte: startOfDay() }, member: { $in: enr.map((e) => e.member._id) } }).lean();
  const inMap = Object.fromEntries(todays.map((a) => [String(a.member), a]));
  res.json({ program: p, members: enr.filter((e) => e.member).map((e) => ({ ...memberDTO(e.member, req.gym.settings), enrollmentDate: e.enrollmentDate, todayVisit: inMap[String(e.member._id)] || null })) });
}));

r.post('/:id/enroll', allow('member', ...STAFF), ah(async (req, res) => {
  const p = await FitnessProgram.findOne({ _id: req.params.id, gym: req.gymId, status: 'Active' });
  if (!p) throw notFound('Program');
  const member = req.role === 'member' ? req.member : await Member.findOne({ _id: req.body.memberId, gym: req.gymId });
  if (!member) throw notFound('Member');
  if (['Expired', 'Pending'].includes(membershipStatus(member.current?.endDate, req.gym.settings))) throw new ApiError(400, 'An active membership is needed to enroll. Renew first.');
  if ((await Enrollment.countDocuments({ program: p._id, status: 'Active' })) >= p.capacity) throw new ApiError(409, 'This program is full.');
  const existing = await Enrollment.findOne({ program: p._id, member: member._id });
  if (existing?.status === 'Active') throw new ApiError(409, 'Already enrolled.');
  if (existing) {
    Object.assign(existing, { status: 'Active', enrollmentDate: new Date(), droppedAt: null });
    await existing.save();
  } else await Enrollment.create({ gym: req.gymId, program: p._id, member: member._id });
  if (p.coach) await notify(toCoach(p.coach), { gym: req.gymId, type: 'Client', title: 'New enrollment', message: `${member.firstName} ${member.lastName} joined ${p.programName}.`, link: '/coach/clients' });
  evaluateBadges(member).catch(() => {});
  audit(req, 'Fitness Program Management', `${member.memberCode} enrolled in ${p.programName}`);
  res.status(201).json({ ok: true });
}));

r.post('/:id/leave', allow('member', ...STAFF), ah(async (req, res) => {
  const memberId = req.role === 'member' ? req.member._id : req.body.memberId;
  const e = await Enrollment.findOne({ program: req.params.id, member: memberId, gym: req.gymId, status: 'Active' });
  if (!e) throw notFound('Enrollment');
  e.status = 'Dropped';
  e.droppedAt = new Date();
  await e.save();
  audit(req, 'Fitness Program Management', 'Dropped a program enrollment');
  res.json({ ok: true });
}));

export default r;
