import { Router } from 'express';
import crypto from 'crypto';
import { Coach, CoachSpecialization, FitnessProgram, ProgramSchedule, Enrollment, Member, Attendance, AVAILABILITY } from '../models/index.js';
import { protect, allow, STAFF } from '../middleware/auth.js';
import { ah, ApiError, requireFields, pick, notFound } from '../utils/http.js';
import { coachDTO, memberDTO } from '../utils/format.js';
import { matchCoaches, specializationsByCoach } from '../utils/rules.js';
import { notify, toCoach, toMember } from '../utils/notify.js';
import { emitToGym } from '../utils/socket.js';
import { sendEmail } from '../utils/email.js';
import { env } from '../config/env.js';
import { audit } from '../utils/audit.js';
import { removeCoach } from '../utils/accountRemoval.js';
import { startOfDay, addDays, startOfWeek } from '../utils/dates.js';

const r = Router();
r.use(protect);
const PROFILE = ['firstName', 'lastName', 'phoneNumber', 'certification', 'experience', 'bio'];

export async function clientIdsOf(coach) {
  const programs = await FitnessProgram.find({ gym: coach.gym, coach: coach._id }).select('_id programName');
  const enrolled = await Enrollment.find({ program: { $in: programs.map((p) => p._id) }, status: 'Active' }).select('member program');
  const assigned = await Member.find({ gym: coach.gym, assignedCoach: coach._id }).select('_id');
  return { ids: [...new Set([...enrolled.map((e) => String(e.member)), ...assigned.map((m) => String(m._id))])], programs, enrolled };
}

async function setSpecializations(coach, names = []) {
  const clean = [...new Set(names.map((n) => String(n).trim()).filter(Boolean))];
  await CoachSpecialization.deleteMany({ coach: coach._id, specializationName: { $nin: clean } });
  for (const name of clean) await CoachSpecialization.updateOne({ coach: coach._id, specializationName: name }, { $setOnInsert: { gym: coach.gym, coach: coach._id, specializationName: name } }, { upsert: true });
  return clean;
}

async function setAvailability(req, coach, value) {
  if (!AVAILABILITY.includes(value)) throw new ApiError(400, 'Availability must be Available, In Session or Unavailable.');
  coach.availabilityStatus = value;
  coach.availabilityUpdatedAt = new Date();
  await coach.save();
  emitToGym(req.gymId, 'coach:availability', { coachId: coach._id, availabilityStatus: value });
}

r.get('/', ah(async (req, res) => {
  const filter = { gym: req.gymId };
  if (!STAFF.includes(req.role)) Object.assign(filter, { status: 'active', activeStatus: 'Active' });
  const [coaches, specs] = await Promise.all([Coach.find(filter).sort({ createdAt: 1 }), specializationsByCoach(req.gymId)]);
  const out = coaches.map((c) => coachDTO(c, specs[String(c._id)] || []));
  if (STAFF.includes(req.role)) {
    const weekStart = startOfWeek();
    await Promise.all(out.map(async (c) => {
      const { ids, programs } = await clientIdsOf({ _id: c._id, gym: req.gymId });
      c.programCount = programs.length;
      c.clientCount = ids.length;
      c.sessionsThisWeek = await ProgramSchedule.countDocuments({ coach: c._id, status: 'Scheduled', scheduleDate: { $gte: weekStart, $lt: addDays(weekStart, 7) } });
    }));
  }
  res.json(out);
}));

r.get('/match', allow('member'), ah(async (req, res) => {
  const goal = req.query.goal || req.member.fitnessGoal;
  const results = await matchCoaches(req.gymId, goal);
  res.json({ goal, results: results.map((x) => ({ coach: coachDTO(x.coach, x.specializations), matched: x.matched, score: x.score })) });
}));

r.post('/:id/choose', allow('member'), ah(async (req, res) => {
  const coach = await Coach.findOne({ _id: req.params.id, gym: req.gymId, status: 'active' });
  if (!coach) throw notFound('Coach');
  req.member.assignedCoach = coach._id;
  await req.member.save();
  await notify(toCoach(coach), { gym: req.gymId, type: 'Client', title: 'New client assigned', message: `${req.member.firstName} ${req.member.lastName} chose you as their coach.`, link: '/coach/clients' });
  res.json({ ok: true });
}));

r.get('/me', allow('coach'), ah(async (req, res) => {
  const specs = await CoachSpecialization.find({ coach: req.coach._id }).lean();
  res.json(coachDTO(req.coach, specs.map((s) => s.specializationName)));
}));

r.patch('/me', allow('coach'), ah(async (req, res) => {
  Object.assign(req.coach, pick(req.body, PROFILE));
  await req.coach.save();
  const specs = Array.isArray(req.body.specializations) ? await setSpecializations(req.coach, req.body.specializations) : (await CoachSpecialization.find({ coach: req.coach._id })).map((s) => s.specializationName);
  audit(req, 'Coach Management', 'Updated own profile and specializations');
  res.json(coachDTO(req.coach, specs));
}));

r.patch('/me/availability', allow('coach'), ah(async (req, res) => {
  await setAvailability(req, req.coach, req.body.availabilityStatus);
  const specs = await CoachSpecialization.find({ coach: req.coach._id }).lean();
  res.json(coachDTO(req.coach, specs.map((s) => s.specializationName)));
}));

r.get('/me/clients', allow('coach'), ah(async (req, res) => {
  const { ids, programs, enrolled } = await clientIdsOf(req.coach);
  const members = await Member.find({ _id: { $in: ids } });
  const since = addDays(startOfDay(), -30);
  const visits = await Attendance.aggregate([{ $match: { member: { $in: members.map((m) => m._id) }, timeIn: { $gte: since } } }, { $group: { _id: '$member', n: { $sum: 1 } } }]);
  const v = Object.fromEntries(visits.map((x) => [String(x._id), x.n]));
  const progName = Object.fromEntries(programs.map((p) => [String(p._id), p.programName]));
  const cut = addDays(startOfDay(), -req.gym.settings.inactiveDays);
  res.json(members.map((m) => ({
    ...memberDTO(m, req.gym.settings),
    visits30: v[String(m._id)] || 0,
    programs: enrolled.filter((e) => String(e.member) === String(m._id)).map((e) => progName[String(e.program)]),
    assignedToMe: String(m.assignedCoach) === String(req.coach._id),
    activity: m.lastVisitAt && new Date(m.lastVisitAt) >= cut ? 'Active' : 'Inactive',
  })));
}));

r.post('/me/clients/:memberId/nudge', allow('coach'), ah(async (req, res) => {
  const { ids } = await clientIdsOf(req.coach);
  if (!ids.includes(req.params.memberId)) throw new ApiError(403, 'This member is not your client.');
  const m = await Member.findById(req.params.memberId);
  await notify(toMember(m), { gym: req.gymId, type: 'Retention', title: 'Your coach misses you!', message: req.body.message || `Coach ${req.coach.firstName}: it's been a while. Your next session is waiting!`, link: '/member/programs', email: true });
  audit(req, 'Retention Support', `Sent a re-engagement reminder to ${m.memberCode}`);
  res.json({ ok: true });
}));

r.post('/', allow('admin'), ah(async (req, res) => {
  requireFields(req.body, ['firstName', 'lastName', 'email']);
  const password = req.body.password || `Coach${crypto.randomBytes(3).toString('hex')}!`;
  const coach = await Coach.create({ gym: req.gymId, email: req.body.email, password, ...pick(req.body, PROFILE) });
  const specs = await setSpecializations(coach, req.body.specializations || []);
  audit(req, 'Coach Management', `Added coach ${coach.firstName} ${coach.lastName}`);
  res.status(201).json({ coach: coachDTO(coach, specs), temporaryPassword: req.body.password ? undefined : password });
}));

r.patch('/:id', allow(...STAFF), ah(async (req, res) => {
  const coach = await Coach.findOne({ _id: req.params.id, gym: req.gymId });
  if (!coach) throw notFound('Coach');
  if (req.body.availabilityStatus) await setAvailability(req, coach, req.body.availabilityStatus);
  let specs;
  if (req.role === 'admin') {
    Object.assign(coach, pick(req.body, [...PROFILE, 'email', 'activeStatus']));
    if (req.body.activeStatus) coach.status = req.body.activeStatus === 'Active' ? 'active' : 'inactive';
    await coach.save();
    if (Array.isArray(req.body.specializations)) specs = await setSpecializations(coach, req.body.specializations);
  }
  specs = specs || (await CoachSpecialization.find({ coach: coach._id })).map((s) => s.specializationName);
  audit(req, 'Coach Management', `Updated coach ${coach.firstName} ${coach.lastName}`);
  res.json(coachDTO(coach, specs));
}));

r.post('/:id/approve', allow('admin'), ah(async (req, res) => {
  const coach = await Coach.findOne({ _id: req.params.id, gym: req.gymId, status: 'pending' });
  if (!coach) throw notFound('Pending coach');
  coach.status = 'active';
  coach.activeStatus = 'Active';
  await coach.save();
  sendEmail({ to: coach.email, subject: `${req.gym.name}: your coach account is approved`, text: `Hi ${coach.firstName},\n\nYour coach account at ${req.gym.name} is approved. Log in here: ${env.siteUrl(req)}/coach/login?gym=${req.gym.slug}` });
  audit(req, 'User and Access Control', `Approved coach account for ${coach.firstName} ${coach.lastName}`);
  res.json(coachDTO(coach, (await CoachSpecialization.find({ coach: coach._id })).map((s) => s.specializationName)));
}));

r.post('/:id/reject', allow('admin'), ah(async (req, res) => {
  const coach = await Coach.findOne({ _id: req.params.id, gym: req.gymId, status: 'pending' });
  if (!coach) throw notFound('Pending coach');
  await CoachSpecialization.deleteMany({ coach: coach._id });
  await Coach.deleteOne({ _id: coach._id });
  sendEmail({ to: coach.email, subject: `${req.gym.name}: coach account request`, text: `Hi ${coach.firstName},\n\nYour coach account request at ${req.gym.name} was not approved. Please contact the gym for details.` });
  audit(req, 'User and Access Control', `Rejected coach account request from ${coach.firstName} ${coach.lastName}`);
  res.json({ ok: true });
}));

r.delete('/:id', allow('admin'), ah(async (req, res) => {
  const coach = await Coach.findOne({ _id: req.params.id, gym: req.gymId });
  if (!coach) throw notFound('Coach');
  if (coach.activeStatus !== 'Inactive' && coach.status !== 'inactive') throw new ApiError(400, 'Set the coach to Inactive first, then delete.');
  const name = `${coach.firstName} ${coach.lastName}`.trim();
  if (String(req.body?.confirm || '').trim().toLowerCase().replace(/\s+/g, ' ') !== name.toLowerCase().replace(/\s+/g, ' ')) throw new ApiError(400, `Type ${name} to confirm.`);
  await removeCoach(coach);
  audit(req, 'Coach Management', `Deleted coach ${name}`);
  res.json({ message: `${name} was deleted. Past sessions and records stay as "Deleted coach".` });
}));

r.post('/:id/reset-password', allow('admin'), ah(async (req, res) => {
  const coach = await Coach.findOne({ _id: req.params.id, gym: req.gymId }).select('+password');
  if (!coach) throw notFound('Coach');
  const temp = `Coach${crypto.randomBytes(3).toString('hex')}!`;
  coach.password = temp;
  await coach.save();
  audit(req, 'User and Access Control', `Reset password for coach ${coach.firstName} ${coach.lastName}`);
  res.json({ temporaryPassword: temp });
}));

export default r;
