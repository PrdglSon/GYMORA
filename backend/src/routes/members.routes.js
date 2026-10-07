import { Router } from 'express';
import crypto from 'crypto';
import { Member, Coach, MembershipPlan, Membership, Payment, Attendance, Enrollment, FitnessProgress, nextCode, FITNESS_GOALS } from '../models/index.js';
import { protect, allow, STAFF } from '../middleware/auth.js';
import { ah, ApiError, requireFields, pick, notFound, paging, escapeRegex } from '../utils/http.js';
import { memberDTO, coachDTO } from '../utils/format.js';
import { sellMembership } from '../utils/membership.js';
import { toggleMemberVisit } from '../utils/attendance.js';
import { notify, notifyStaff, toMember } from '../utils/notify.js';
import { specializationsByCoach } from '../utils/rules.js';
import { upload, saveFile } from '../utils/upload.js';
import { audit } from '../utils/audit.js';
import { startOfDay, addDays } from '../utils/dates.js';
import { clientIdsOf } from './coaches.routes.js';
import { sendEmail } from '../utils/email.js';
import { liveQr } from '../utils/liveQr.js';
import { removeMember } from '../utils/accountRemoval.js';
import { env } from '../config/env.js';

const r = Router();
r.use(protect);

const PROFILE_FIELDS = ['firstName', 'lastName', 'phoneNumber', 'gender', 'birthdate', 'address', 'emergencyContact', 'fitnessGoal', 'heightCm'];

function statusFilter(status, settings) {
  const today = startOfDay();
  const near = addDays(today, settings.nearExpiryDays ?? 7);
  switch (status) {
    case 'Active': return { 'current.endDate': { $gt: near } };
    case 'Near Expiry': return { 'current.endDate': { $gte: today, $lte: near } };
    case 'Expired': return { 'current.endDate': { $lt: today } };
    case 'Pending': return { 'current.endDate': null };
    case 'Student pending': return { 'student.status': 'pending' };
    default: return {};
  }
}

async function loadMember(req, id) {
  const m = await Member.findOne({ _id: id, gym: req.gymId });
  if (!m) throw notFound('Member');
  return m;
}

r.get('/me', allow('member'), ah(async (req, res) => {
  const m = req.member;
  const [memberships, payments, coach] = await Promise.all([
    Membership.find({ member: m._id }).sort({ createdAt: -1 }).limit(20).lean(),
    Payment.find({ member: m._id }).sort({ createdAt: -1 }).limit(50).lean(),
    m.assignedCoach ? Coach.findById(m.assignedCoach).lean() : null,
  ]);
  const specs = coach ? (await specializationsByCoach(req.gymId))[String(coach._id)] || [] : [];
  res.json({ member: memberDTO(m, req.gym.settings), memberships, payments, coach: coach ? coachDTO(coach, specs) : null });
}));

r.patch('/me', allow('member'), ah(async (req, res) => {
  if (req.body.fitnessGoal && !FITNESS_GOALS.includes(req.body.fitnessGoal)) throw new ApiError(400, 'Unknown fitness goal.');
  Object.assign(req.member, pick(req.body, PROFILE_FIELDS));
  await req.member.save();
  res.json(memberDTO(req.member, req.gym.settings));
}));

r.get('/me/qr-live', allow('member'), ah(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(liveQr(req.member));
}));

r.post('/me/student-id', allow('member'), upload.single('document'), ah(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Attach a photo or PDF of your school ID.');
  const m = req.member;
  m.student.isStudent = true;
  m.student.status = 'pending';
  if (req.body.school) m.student.school = req.body.school;
  m.student.idDocumentUrl = await saveFile(req.file, 'student-ids');
  await m.save();
  await notifyStaff(req.gymId, { type: 'Student Verification', title: 'Student ID to verify', message: `${m.firstName} ${m.lastName} (${m.memberCode})`, link: '/admin/members?status=Student%20pending' });
  res.json(memberDTO(m, req.gym.settings));
}));

r.post('/me/renew', allow('member'), ah(async (req, res) => {
  requireFields(req.body, ['planId', 'method']);
  const plan = await MembershipPlan.findOne({ _id: req.body.planId, gym: req.gymId, status: 'Active' });
  if (!plan) throw new ApiError(400, 'Choose a valid plan.');
  if (plan.isStudentPlan && req.member.student?.status !== 'verified') throw new ApiError(400, 'Verify your school ID first to use the student plan.');
  const open = await Payment.findOne({ member: req.member._id, paymentType: 'Membership', status: 'Unpaid' });
  if (open) throw new ApiError(409, `You already have an unpaid invoice (${open.receiptNo}). Pay it at the front desk or wait for staff to verify it.`);
  if (req.body.method === 'GCash' && !/^\d{10,13}$/.test(String(req.body.referenceNumber || ''))) throw new ApiError(400, 'Enter the 10 to 13 digit GCash reference number.');
  const { payment } = await sellMembership({ gym: req.gymId, member: req.member, plan, paid: false, allowDuplicate: true });
  if (req.body.method === 'GCash') {
    payment.referenceNumber = req.body.referenceNumber;
    payment.description += ' (GCash, for verification)';
    await payment.save();
  }
  await notifyStaff(req.gymId, { type: 'Payment', title: req.body.method === 'GCash' ? 'GCash payment to verify' : 'Renewal reserved', message: `${req.member.firstName} ${req.member.lastName}: ${plan.planName} ₱${plan.price}${req.body.referenceNumber ? ` · Ref ${req.body.referenceNumber}` : ''}`, link: '/admin/billing?status=Unpaid' });
  res.status(201).json({ payment, message: req.body.method === 'GCash' ? 'Payment submitted. Your plan activates once staff verify the GCash reference.' : 'Renewal reserved. Pay at the front desk to activate it.' });
}));

r.get('/', allow(...STAFF), ah(async (req, res) => {
  const { limit, skip } = paging(req.query, 50);
  const filter = { gym: req.gymId, ...statusFilter(req.query.status, req.gym.settings) };
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { phoneNumber: rx }, { memberCode: rx }];
  }
  const [items, total] = await Promise.all([Member.find(filter).sort({ registrationDate: -1 }).skip(skip).limit(limit), Member.countDocuments(filter)]);
  res.json({ items: items.map((m) => memberDTO(m, req.gym.settings)), total });
}));

r.get('/stats', allow(...STAFF), ah(async (req, res) => {
  const s = req.gym.settings;
  const base = { gym: req.gymId };
  const count = (f) => Member.countDocuments({ ...base, ...f });
  const [total, active, nearExpiry, expired, pending, studentPending, newThisMonth] = await Promise.all([
    count({}), count(statusFilter('Active', s)), count(statusFilter('Near Expiry', s)), count(statusFilter('Expired', s)), count(statusFilter('Pending', s)), count({ 'student.status': 'pending' }), count({ registrationDate: { $gte: addDays(startOfDay(), -30) } }),
  ]);
  res.json({ total, active, nearExpiry, expired, pending, studentPending, newThisMonth });
}));

r.post('/', allow(...STAFF), ah(async (req, res) => {
  requireFields(req.body, ['firstName', 'lastName', 'email', 'phoneNumber']);
  if (req.body.password && String(req.body.password).length < 8) throw new ApiError(400, 'Password must be at least 8 characters.');
  const password = req.body.password || `Gym${crypto.randomBytes(3).toString('hex')}!`;
  const member = await Member.create({
    gym: req.gymId,
    email: req.body.email,
    password,
    memberCode: await nextCode(req.gymId, 'member'),
    ...pick(req.body, PROFILE_FIELDS),
    student: req.body.isStudent ? { isStudent: true, status: 'verified', school: req.body.school, reviewedBy: req.account._id, reviewedAt: new Date(), note: 'Checked at front desk' } : undefined,
  });
  let payment = null;
  if (req.body.planId) {
    const plan = await MembershipPlan.findOne({ _id: req.body.planId, gym: req.gymId });
    if (!plan) throw new ApiError(400, 'Unknown plan.');
    const paid = req.body.method && req.body.method !== 'Unpaid';
    ({ payment } = await sellMembership({ gym: req.gymId, member, plan, paid, method: req.body.method, referenceNumber: req.body.referenceNumber, recordedBy: req.account._id }));
  }
  sendEmail({
    to: member.email,
    subject: `Welcome to ${req.gym.name}`,
    text: `Hi ${member.firstName},\n\nYour member account at ${req.gym.name} is ready.\n\nMember code: ${member.memberCode}\nLogin: ${env.siteUrl(req)}/member/login?gym=${req.gym.slug}\nEmail: ${member.email}\n${req.body.password ? 'Password: the one you gave at the front desk' : `Temporary password: ${password}`}\n\nYou can change your password after logging in, or use "Forgot password?" on the login page.`,
  });
  audit(req, 'Member Management', `Registered ${member.firstName} ${member.lastName} (${member.memberCode})`);
  res.status(201).json({ member: memberDTO(member, req.gym.settings), payment, temporaryPassword: req.body.password ? undefined : password });
}));

r.get('/:id', allow(...STAFF, 'coach'), ah(async (req, res) => {
  const m = await loadMember(req, req.params.id);
  if (req.role === 'coach') {
    const { ids } = await clientIdsOf(req.coach);
    if (!ids.includes(String(m._id))) throw new ApiError(403, 'This member is not your client.');
  }
  const [memberships, payments, visits, enrollments, progress] = await Promise.all([
    Membership.find({ member: m._id }).sort({ createdAt: -1 }).lean(),
    req.role === 'coach' ? [] : Payment.find({ member: m._id }).sort({ createdAt: -1 }).limit(30).lean(),
    Attendance.find({ member: m._id }).sort({ timeIn: -1 }).limit(30).lean(),
    Enrollment.find({ member: m._id, status: 'Active' }).populate('program', 'programName category').lean(),
    FitnessProgress.find({ member: m._id }).sort({ recordDate: 1 }).lean(),
  ]);
  res.json({ member: memberDTO(m, req.gym.settings), memberships, payments, visits, enrollments, progress });
}));

r.patch('/:id', allow(...STAFF), ah(async (req, res) => {
  const m = await loadMember(req, req.params.id);
  Object.assign(m, pick(req.body, [...PROFILE_FIELDS, 'assignedCoach', 'email']));
  if (req.body.accountStatus) m.status = req.body.accountStatus === 'inactive' ? 'inactive' : 'active';
  await m.save();
  audit(req, 'Member Management', `Updated ${m.memberCode}`);
  res.json(memberDTO(m, req.gym.settings));
}));

r.post('/:id/memberships', allow(...STAFF), ah(async (req, res) => {
  requireFields(req.body, ['planId']);
  const m = await loadMember(req, req.params.id);
  const plan = await MembershipPlan.findOne({ _id: req.body.planId, gym: req.gymId });
  if (!plan) throw new ApiError(400, 'Unknown plan.');
  if (plan.isStudentPlan && m.student?.status !== 'verified') throw new ApiError(400, 'Verify the student ID before selling the student plan.');
  const paid = req.body.method !== 'Unpaid';
  const result = await sellMembership({ gym: req.gymId, member: m, plan, paid, method: req.body.method || 'Cash', referenceNumber: req.body.referenceNumber, recordedBy: req.account._id, allowDuplicate: req.body.allowDuplicate === true });
  if (paid) await notify(toMember(m), { gym: req.gymId, type: 'Membership', title: 'Membership renewed', message: `${plan.planName} is active until ${new Date(m.current.endDate).toDateString()}.`, link: '/member/payments', email: true });
  audit(req, 'Payment and Billing', `Sold ${plan.planName} to ${m.memberCode} (${paid ? req.body.method || 'Cash' : 'unpaid'})`);
  res.status(201).json({ member: memberDTO(m, req.gym.settings), ...result });
}));

r.delete('/:id', allow('admin'), ah(async (req, res) => {
  const m = await loadMember(req, req.params.id);
  if (m.status !== 'inactive') throw new ApiError(400, 'Deactivate the account first, then delete it.');
  if (String(req.body?.confirm || '').trim().toUpperCase() !== m.memberCode.toUpperCase()) throw new ApiError(400, `Type ${m.memberCode} to confirm.`);
  const label = `${m.firstName} ${m.lastName} (${m.memberCode})`;
  await removeMember(m);
  audit(req, 'Member Management', `Deleted member ${label}`);
  res.json({ message: `${label} was deleted. Payments and attendance stay as "Deleted member".` });
}));

r.post('/:id/student-review', allow(...STAFF), ah(async (req, res) => {
  const m = await loadMember(req, req.params.id);
  const decision = req.body.decision === 'verified' ? 'verified' : 'rejected';
  m.student.status = decision;
  m.student.isStudent = decision === 'verified';
  m.student.reviewedBy = req.account._id;
  m.student.reviewedAt = new Date();
  m.student.note = req.body.note;
  await m.save();
  await notify(toMember(m), { gym: req.gymId, type: 'Student Verification', title: 'Student verification', message: decision === 'verified' ? 'Your school ID was approved. You can now choose the student plan.' : `Your school ID was not accepted.${req.body.note ? ` ${req.body.note}` : ''}`, link: '/member/profile' });
  audit(req, 'Member Management', `${decision === 'verified' ? 'Approved' : 'Rejected'} student ID of ${m.memberCode}`);
  res.json(memberDTO(m, req.gym.settings));
}));

r.post('/:id/checkin', allow(...STAFF), ah(async (req, res) => {
  const m = await loadMember(req, req.params.id);
  const result = await toggleMemberVisit({ gym: req.gymId, settings: req.gym.settings, member: m, method: 'Front Desk', recordedBy: req.account._id });
  if (result.ok) audit(req, 'Attendance', `Front desk tap-${result.action}: ${m.memberCode}`);
  res.json(result);
}));

r.post('/:id/reset-password', allow('admin'), ah(async (req, res) => {
  const m = await Member.findOne({ _id: req.params.id, gym: req.gymId }).select('+password');
  if (!m) throw notFound('Member');
  const temp = `Gym${crypto.randomBytes(3).toString('hex')}!`;
  m.password = temp;
  await m.save();
  audit(req, 'User and Access Control', `Reset password for ${m.memberCode}`);
  res.json({ temporaryPassword: temp });
}));

export default r;
