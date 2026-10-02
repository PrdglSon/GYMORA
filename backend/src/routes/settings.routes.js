import { Router } from 'express';
import crypto from 'crypto';
import { Gym, StaffAdmin } from '../models/index.js';
import { protect, allow, STAFF } from '../middleware/auth.js';
import { ah, ApiError, requireFields, pick, notFound } from '../utils/http.js';
import { upload, saveFile } from '../utils/upload.js';
import { sendEmail } from '../utils/email.js';
import { env } from '../config/env.js';
import { audit } from '../utils/audit.js';
import { staffDTO } from '../utils/format.js';
import { runDailyJobs } from '../jobs/daily.js';

const r = Router();
r.use(protect, allow(...STAFF));

const GYM_FIELDS = ['name', 'tagline', 'about', 'email', 'phoneNumber', 'address', 'city', 'country'];
const SETTING_FIELDS = ['timezone', 'currency', 'openTime', 'closeTime', 'walkInFee', 'graceDays', 'inactiveDays', 'nearExpiryDays', 'allowOnlineSignup', 'emailNotifications', 'discounts', 'programCategories', 'specializations'];

r.get('/', ah(async (req, res) => res.json(await Gym.findById(req.gymId))));

r.patch('/', allow('admin'), ah(async (req, res) => {
  const gym = await Gym.findById(req.gymId);
  Object.assign(gym, pick(req.body, GYM_FIELDS));
  if (req.body.settings) for (const k of SETTING_FIELDS) if (req.body.settings[k] !== undefined) gym.settings[k] = req.body.settings[k];
  await gym.save();
  audit(req, 'System Settings', 'Updated gym settings');
  res.json(gym);
}));

r.post('/logo', allow('admin'), upload.single('logo'), ah(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Choose an image.');
  const gym = await Gym.findById(req.gymId);
  gym.logoUrl = await saveFile(req.file, 'logos');
  await gym.save();
  audit(req, 'System Settings', 'Changed logo');
  res.json(gym);
}));

r.post('/kiosk-key', allow('admin'), ah(async (req, res) => {
  const gym = await Gym.findById(req.gymId);
  gym.settings.kioskKey = crypto.randomBytes(4).toString('hex').toUpperCase();
  await gym.save();
  audit(req, 'System Settings', 'Generated a new kiosk key');
  res.json({ kioskKey: gym.settings.kioskKey });
}));

r.post('/run-daily-jobs', allow('admin'), ah(async (req, res) => {
  const result = await runDailyJobs({ gymId: req.gymId });
  audit(req, 'System Settings', 'Ran scheduled jobs manually', result);
  res.json(result);
}));

r.get('/staff', allow('admin'), ah(async (req, res) => {
  res.json((await StaffAdmin.find({ gym: req.gymId }).sort({ role: 1, firstName: 1 })).map(staffDTO));
}));

r.post('/staff', allow('admin'), ah(async (req, res) => {
  requireFields(req.body, ['firstName', 'lastName', 'email', 'role']);
  if (!['admin', 'receptionist'].includes(req.body.role)) throw new ApiError(400, 'Role must be admin or receptionist.');
  const password = req.body.password || `Staff${crypto.randomBytes(3).toString('hex')}!`;
  const s = await StaffAdmin.create({ gym: req.gymId, password, ...pick(req.body, ['firstName', 'lastName', 'email', 'phoneNumber', 'role']) });
  audit(req, 'User and Access Control', `Added ${s.role} ${s.firstName} ${s.lastName}`);
  res.status(201).json({ staff: staffDTO(s), temporaryPassword: req.body.password ? undefined : password });
}));

r.patch('/staff/:id', allow('admin'), ah(async (req, res) => {
  const s = await StaffAdmin.findOne({ _id: req.params.id, gym: req.gymId });
  if (!s) throw notFound('Staff account');
  if (String(s._id) === String(req.account._id) && (req.body.status === 'inactive' || req.body.role === 'receptionist')) throw new ApiError(400, "You can't deactivate or demote your own account.");
  Object.assign(s, pick(req.body, ['firstName', 'lastName', 'phoneNumber', 'role', 'status']));
  await s.save();
  audit(req, 'User and Access Control', `Updated ${s.firstName} ${s.lastName} (${s.role}, ${s.status})`);
  res.json(staffDTO(s));
}));

r.post('/staff/:id/approve', allow('admin'), ah(async (req, res) => {
  const s = await StaffAdmin.findOne({ _id: req.params.id, gym: req.gymId, status: 'pending' });
  if (!s) throw notFound('Pending staff account');
  s.status = 'active';
  await s.save();
  sendEmail({ to: s.email, subject: `${req.gym.name}: your staff account is approved`, text: `Hi ${s.firstName},\n\nYour staff account at ${req.gym.name} is approved. Log in here: ${env.clientUrl}/staff/login?gym=${req.gym.slug}` });
  audit(req, 'User and Access Control', `Approved staff account for ${s.firstName} ${s.lastName}`);
  res.json(staffDTO(s));
}));

r.post('/staff/:id/reject', allow('admin'), ah(async (req, res) => {
  const s = await StaffAdmin.findOne({ _id: req.params.id, gym: req.gymId, status: 'pending' });
  if (!s) throw notFound('Pending staff account');
  await StaffAdmin.deleteOne({ _id: s._id });
  sendEmail({ to: s.email, subject: `${req.gym.name}: staff account request`, text: `Hi ${s.firstName},\n\nYour staff account request at ${req.gym.name} was not approved. Please contact the gym for details.` });
  audit(req, 'User and Access Control', `Rejected staff account request from ${s.firstName} ${s.lastName}`);
  res.json({ ok: true });
}));

r.post('/staff/:id/reset-password', allow('admin'), ah(async (req, res) => {
  const s = await StaffAdmin.findOne({ _id: req.params.id, gym: req.gymId }).select('+password');
  if (!s) throw notFound('Staff account');
  const temp = `Staff${crypto.randomBytes(3).toString('hex')}!`;
  s.password = temp;
  await s.save();
  audit(req, 'User and Access Control', `Reset password for ${s.firstName} ${s.lastName}`);
  res.json({ temporaryPassword: temp });
}));

export default r;
