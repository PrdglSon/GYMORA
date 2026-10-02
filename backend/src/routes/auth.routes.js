import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { Gym, CoachSpecialization } from '../models/index.js';
import { protect, signToken, PORTALS, ACCOUNT_MODELS, roleOf } from '../middleware/auth.js';
import { ah, ApiError, requireFields, pick } from '../utils/http.js';
import { createGymWithOwner } from '../utils/gymSetup.js';
import { sendEmail } from '../utils/email.js';
import { memberDTO, coachDTO, staffDTO, fullName } from '../utils/format.js';
import { upload, saveFile } from '../utils/upload.js';
import { audit } from '../utils/audit.js';
import { env } from '../config/env.js';

const r = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many attempts. Try again in a few minutes.' } });

export function publicGym(g) {
  if (!g) return null;
  const { settings = {}, ...rest } = g.toObject ? g.toObject() : g;
  const { kioskKey, ...safe } = settings;
  return { ...rest, settings: safe };
}

export async function sessionPayload(type, account) {
  const role = roleOf(type, account);
  const gym = account.gym ? await Gym.findById(account.gym) : null;
  let profile;
  if (type === 'Member') profile = memberDTO(account, gym?.settings);
  else if (type === 'Coach') profile = coachDTO(account, (await CoachSpecialization.find({ coach: account._id }).lean()).map((s) => s.specializationName));
  else if (type === 'StaffAdmin') profile = staffDTO(account);
  else profile = { _id: account._id, firstName: account.firstName, lastName: account.lastName, name: fullName(account), email: account.email };
  return { accountType: type, role, account: profile, gym: role === 'admin' || role === 'receptionist' ? gym?.toObject() : publicGym(gym) };
}

r.post('/login', limiter, ah(async (req, res) => {
  requireFields(req.body, ['portal', 'email', 'password']);
  const portal = PORTALS[req.body.portal];
  if (!portal) throw new ApiError(400, 'Unknown login page.');
  const Model = ACCOUNT_MODELS[portal.model];
  const email = String(req.body.email).toLowerCase().trim();
  const query = Model.find({ email }).select('+password');
  if (portal.model !== 'PlatformAdmin') query.populate({ path: 'gym', select: 'name slug status' });
  let found = await query;
  if (req.body.gymSlug && portal.model !== 'PlatformAdmin') found = found.filter((a) => a.gym?.slug === req.body.gymSlug);
  const valid = [];
  for (const a of found) if (await a.checkPassword(req.body.password)) valid.push(a);
  if (!valid.length) throw new ApiError(401, 'Wrong email or password.');
  let matches = valid;
  if (portal.model === 'StaffAdmin') {
    matches = valid.filter((a) => a.role === portal.role);
    if (!matches.length) {
      const other = valid[0].role === 'admin' ? 'Administrator' : 'Staff';
      throw new ApiError(403, `This is a${other === 'Administrator' ? 'n' : ''} ${other} account. Please use the ${other === 'Administrator' ? 'Admin' : 'Staff'} login.`);
    }
  }
  if (matches.length > 1) return res.status(409).json({ message: 'This email is registered at more than one gym. Choose your gym.', gyms: matches.map((a) => ({ name: a.gym?.name, slug: a.gym?.slug })) });
  const account = matches[0];
  if (account.status === 'pending') throw new ApiError(403, 'Your account is waiting for approval from the gym administrator. You will get an email once it is approved.');
  if (account.status !== 'active') throw new ApiError(403, 'This account is deactivated. Contact your gym.');
  if (account.gym && account.gym.status !== 'active') throw new ApiError(403, account.gym.status === 'pending' ? 'Your gym is waiting for approval.' : 'This gym account is suspended.');
  account.lastLoginAt = new Date();
  await account.save();
  const fresh = await Model.findById(account._id);
  req.account = fresh;
  req.accountType = portal.model;
  req.role = roleOf(portal.model, fresh);
  req.gymId = fresh.gym;
  audit(req, 'Authentication', `Logged in through the ${portal.label} login`);
  res.json({ token: signToken(portal.model, fresh), ...(await sessionPayload(portal.model, fresh)) });
}));

r.get('/me', protect, ah(async (req, res) => res.json(await sessionPayload(req.accountType, req.account))));

r.post('/register-gym', limiter, ah(async (req, res) => {
  requireFields(req.body, ['gymName', 'firstName', 'lastName', 'email', 'password']);
  if (String(req.body.password).length < 8) throw new ApiError(400, 'Password must be at least 8 characters.');
  const status = env.autoApproveGyms ? 'active' : 'pending';
  const { gym, admin } = await createGymWithOwner({
    status,
    gym: { name: req.body.gymName, email: req.body.email, phoneNumber: req.body.phoneNumber, city: req.body.city, address: req.body.address, branches: req.body.branches || 1, estimatedMembers: req.body.estimatedMembers },
    owner: { email: req.body.email, password: req.body.password, firstName: req.body.firstName, lastName: req.body.lastName, phoneNumber: req.body.phoneNumber },
  });
  sendEmail({ to: admin.email, subject: `Welcome to GYMORA, ${gym.name}`, text: status === 'active' ? `Your gym is ready. Log in at ${env.clientUrl}/admin/login` : 'We received your registration. The GYMORA team will review it soon.' });
  if (status !== 'active') return res.status(201).json({ pending: true, message: 'Thanks! Your gym is waiting for approval. We will email you when it is live.' });
  res.status(201).json({ token: signToken('StaffAdmin', admin), ...(await sessionPayload('StaffAdmin', admin)) });
}));

r.post('/forgot', limiter, ah(async (req, res) => {
  requireFields(req.body, ['portal', 'email']);
  const portal = PORTALS[req.body.portal];
  if (!portal) throw new ApiError(400, 'Unknown login page.');
  const accounts = await ACCOUNT_MODELS[portal.model].find({ email: String(req.body.email).toLowerCase().trim() });
  for (const a of accounts) {
    const token = crypto.randomBytes(24).toString('hex');
    a.resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    a.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    await a.save();
    await sendEmail({ to: a.email, subject: 'Reset your GYMORA password', text: `Reset your password within 1 hour:\n${env.clientUrl}/reset-password?type=${portal.model}&token=${token}` });
  }
  res.json({ message: 'If that email is registered, a reset link is on its way.' });
}));

r.post('/reset', limiter, ah(async (req, res) => {
  requireFields(req.body, ['type', 'token', 'password']);
  const Model = ACCOUNT_MODELS[req.body.type];
  if (!Model) throw new ApiError(400, 'Invalid reset link.');
  if (String(req.body.password).length < 8) throw new ApiError(400, 'Password must be at least 8 characters.');
  const hash = crypto.createHash('sha256').update(req.body.token).digest('hex');
  const account = await Model.findOne({ resetTokenHash: hash, resetTokenExpires: { $gt: new Date() } });
  if (!account) throw new ApiError(400, 'This reset link is invalid or expired. Request a new one.');
  account.password = req.body.password;
  account.resetTokenHash = undefined;
  account.resetTokenExpires = undefined;
  await account.save();
  res.json({ message: 'Password updated. You can log in now.' });
}));

r.patch('/password', protect, ah(async (req, res) => {
  requireFields(req.body, ['currentPassword', 'newPassword']);
  const account = await ACCOUNT_MODELS[req.accountType].findById(req.account._id).select('+password');
  if (!(await account.checkPassword(req.body.currentPassword))) throw new ApiError(400, 'Current password is wrong.');
  if (String(req.body.newPassword).length < 8) throw new ApiError(400, 'New password must be at least 8 characters.');
  account.password = req.body.newPassword;
  await account.save();
  audit(req, 'Authentication', 'Changed password');
  res.json({ message: 'Password changed.' });
}));

r.patch('/account', protect, upload.single('avatar'), ah(async (req, res) => {
  Object.assign(req.account, pick(req.body, ['firstName', 'lastName', 'phoneNumber']));
  if (req.file) req.account.avatarUrl = await saveFile(req.file, 'avatars');
  await req.account.save();
  res.json(await sessionPayload(req.accountType, req.account));
}));

export default r;
