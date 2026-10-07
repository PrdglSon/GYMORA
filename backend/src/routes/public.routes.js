import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Gym, Member, Coach, StaffAdmin, CoachSpecialization, MembershipPlan, FitnessProgram, ProgramSchedule, Enrollment, CommunityPost, Attendance, Inquiry, nextCode, FITNESS_GOALS } from '../models/index.js';
import { ah, ApiError, requireFields, notFound } from '../utils/http.js';
import { signToken } from '../middleware/auth.js';
import { sellMembership } from '../utils/membership.js';
import { notifyStaff } from '../utils/notify.js';
import { sendEmail } from '../utils/email.js';
import { coachDTO, fullName } from '../utils/format.js';
import { specializationsByCoach } from '../utils/rules.js';
import { startOfDay, addDays } from '../utils/dates.js';
import { publicGym, sessionPayload } from './auth.routes.js';

const r = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many requests. Try again later.' } });

async function gymBySlug(slug) {
  const gym = await Gym.findOne({ slug, status: 'active' });
  if (!gym) throw notFound('Gym');
  return gym;
}

r.get('/gyms', ah(async (req, res) => {
  res.json(await Gym.find({ status: 'active' }).select('name slug city tagline logoUrl').sort({ name: 1 }).lean());
}));

r.get('/gyms/:slug', ah(async (req, res) => {
  const gym = await gymBySlug(req.params.slug);
  const [plans, programs, coaches, specs, posts, inGym, sessions, counts] = await Promise.all([
    MembershipPlan.find({ gym: gym._id, status: 'Active' }).sort({ sortOrder: 1, price: 1 }).lean(),
    FitnessProgram.find({ gym: gym._id, status: 'Active' }).populate('coach', 'firstName lastName').lean(),
    Coach.find({ gym: gym._id, status: 'active', activeStatus: 'Active' }).lean(),
    specializationsByCoach(gym._id),
    CommunityPost.find({ gym: gym._id, status: 'Visible', tag: { $in: ['Announcements', 'Promotions', 'Events', 'Progress'] } }).sort({ pinned: -1, datePosted: -1 }).limit(6).lean(),
    Attendance.countDocuments({ gym: gym._id, timeOut: null, timeIn: { $gte: startOfDay() } }),
    ProgramSchedule.find({ gym: gym._id, status: 'Scheduled', scheduleDate: { $gte: startOfDay(), $lt: addDays(startOfDay(), 7) } }).populate('program', 'programName category').populate('coach', 'firstName lastName').sort({ scheduleDate: 1, startTime: 1 }).lean(),
    Enrollment.aggregate([{ $match: { gym: gym._id, status: 'Active' } }, { $group: { _id: '$program', n: { $sum: 1 } } }]),
  ]);
  const byProgram = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  res.json({
    gym: publicGym(gym),
    plans,
    programs: programs.map((p) => ({ ...p, coachName: fullName(p.coach), enrolled: byProgram[String(p._id)] || 0 })),
    schedule: sessions.filter((s) => s.program).map((s) => ({ _id: s._id, programName: s.program.programName, category: s.program.category, coachName: fullName(s.coach), scheduleDate: s.scheduleDate, startTime: s.startTime, endTime: s.endTime })),
    coaches: coaches.map((c) => coachDTO(c, specs[String(c._id)] || [])),
    posts: posts.map((p) => ({ _id: p._id, content: p.content, tag: p.tag, image: p.image, likes: p.likes.length, comments: p.comments.length, datePosted: p.datePosted, authorName: p.authorName, authorType: p.authorType })),
    inGymNow: inGym,
    goals: FITNESS_GOALS,
  });
}));

r.post('/gyms/:slug/register', limiter, ah(async (req, res) => {
  const gym = await gymBySlug(req.params.slug);
  if (!gym.settings.allowOnlineSignup) throw new ApiError(403, 'Online registration is turned off. Please register at the front desk.');
  requireFields(req.body, ['firstName', 'lastName', 'email', 'password', 'phoneNumber', 'planId']);
  if (String(req.body.password).length < 8) throw new ApiError(400, 'Password must be at least 8 characters.');
  const plan = await MembershipPlan.findOne({ _id: req.body.planId, gym: gym._id, status: 'Active' });
  if (!plan) throw new ApiError(400, 'Choose a valid membership plan.');
  const isStudent = !!req.body.isStudent;
  if (plan.isStudentPlan && !isStudent) throw new ApiError(400, 'The student plan is for students. Tick "I am a student" or choose another plan.');
  const member = await Member.create({
    gym: gym._id,
    email: req.body.email,
    password: req.body.password,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    phoneNumber: req.body.phoneNumber,
    memberCode: await nextCode(gym._id, 'member'),
    fitnessGoal: FITNESS_GOALS.includes(req.body.fitnessGoal) ? req.body.fitnessGoal : 'General Fitness',
    gender: req.body.gender || undefined,
    birthdate: req.body.birthdate || undefined,
    heightCm: req.body.heightCm || undefined,
    student: { isStudent, status: 'none', school: req.body.school },
  });
  const { payment: invoice } = await sellMembership({ gym: gym._id, member, plan, paid: false });
  await notifyStaff(gym._id, { type: 'Membership', title: 'New online registration', message: `${member.firstName} ${member.lastName} signed up for ${plan.planName}. Payment pending.`, link: '/admin/members' });
  res.status(201).json({ token: signToken('Member', member), ...(await sessionPayload('Member', member)), invoiceId: invoice._id });
}));

r.post('/gyms/:slug/inquiry', limiter, ah(async (req, res) => {
  const gym = await gymBySlug(req.params.slug);
  requireFields(req.body, ['fullName', 'contact', 'message']);
  const inq = await Inquiry.create({ gym: gym._id, inquiryNo: await nextCode(gym._id, 'inquiry'), inquiryType: req.body.inquiryType === 'Membership' ? 'Membership' : 'Inquiry', fullName: req.body.fullName, contact: req.body.contact, subject: req.body.subject || 'Website inquiry', message: req.body.message });
  await notifyStaff(gym._id, { type: 'Inquiry', title: 'New inquiry', message: `${inq.fullName}: ${inq.subject}`, link: '/admin/support' });
  res.status(201).json({ message: 'Thanks! The front desk will get back to you soon.' });
}));

r.post('/gyms/:slug/coach-application', limiter, ah(async (req, res) => {
  const gym = await gymBySlug(req.params.slug);
  requireFields(req.body, ['fullName', 'email', 'specialization']);
  await Inquiry.create({
    gym: gym._id,
    inquiryNo: await nextCode(gym._id, 'inquiry'),
    inquiryType: 'Coach Application',
    fullName: req.body.fullName,
    contact: [req.body.email, req.body.phoneNumber].filter(Boolean).join(' · '),
    subject: `Coach application: ${req.body.specialization}`,
    message: `Experience: ${req.body.experience || 0} years\nCertification: ${req.body.certification || 'none listed'}\n${req.body.message || ''}`,
  });
  await notifyStaff(gym._id, { type: 'Inquiry', title: 'New coach application', message: req.body.fullName, link: '/admin/support' }, ['admin']);
  res.status(201).json({ message: 'Application sent. The gym will contact you by email.' });
}));

function checkNewAccount(body) {
  requireFields(body, ['firstName', 'lastName', 'email', 'phoneNumber', 'password']);
  if (String(body.password).length < 8) throw new ApiError(400, 'Password must be at least 8 characters.');
}

r.post('/gyms/:slug/coach-signup', limiter, ah(async (req, res) => {
  const gym = await gymBySlug(req.params.slug);
  checkNewAccount(req.body);
  const coach = await Coach.create({
    gym: gym._id,
    email: req.body.email,
    password: req.body.password,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    phoneNumber: req.body.phoneNumber,
    experience: Number(req.body.experience) || 0,
    certification: req.body.certification,
    bio: req.body.bio,
    status: 'pending',
    activeStatus: 'Inactive',
  });
  const names = [...new Set((Array.isArray(req.body.specializations) ? req.body.specializations : []).map((x) => String(x).trim()).filter(Boolean))];
  if (names.length) await CoachSpecialization.insertMany(names.map((specializationName) => ({ gym: gym._id, coach: coach._id, specializationName })));
  await notifyStaff(gym._id, { type: 'Account Request', title: 'New coach account request', message: `${coach.firstName} ${coach.lastName} wants to join as a coach. Approve or reject it in Coaches.`, link: '/admin/coaches', email: true }, ['admin']);
  sendEmail({ to: coach.email, subject: `${gym.name}: coach account request received`, text: `Hi ${coach.firstName},\n\nWe received your coach account request at ${gym.name}. You can log in once the gym administrator approves it. We will email you when that happens.` });
  res.status(201).json({ message: 'Account created. You can log in once the gym administrator approves it. We will email you.' });
}));

r.post('/gyms/:slug/staff-signup', limiter, ah(async (req, res) => {
  const gym = await gymBySlug(req.params.slug);
  checkNewAccount(req.body);
  const staff = await StaffAdmin.create({
    gym: gym._id,
    email: req.body.email,
    password: req.body.password,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    phoneNumber: req.body.phoneNumber,
    role: 'receptionist',
    status: 'pending',
  });
  await notifyStaff(gym._id, { type: 'Account Request', title: 'New staff account request', message: `${staff.firstName} ${staff.lastName} wants to join as front-desk staff. Approve or reject it in System Settings → Staff accounts.`, link: '/admin/settings', email: true }, ['admin']);
  sendEmail({ to: staff.email, subject: `${gym.name}: staff account request received`, text: `Hi ${staff.firstName},\n\nWe received your staff account request at ${gym.name}. You can log in once the gym administrator approves it. We will email you when that happens.` });
  res.status(201).json({ message: 'Account created. You can log in once the gym administrator approves it. We will email you.' });
}));

export default r;
