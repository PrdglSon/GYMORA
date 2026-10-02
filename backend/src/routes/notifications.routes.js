import { Router } from 'express';
import { Notification } from '../models/index.js';
import { protect, allow } from '../middleware/auth.js';
import { ah, requireFields, ApiError } from '../utils/http.js';
import { notifyAllMembers, notifyAllCoaches, notifyStaff } from '../utils/notify.js';
import { audit } from '../utils/audit.js';

const r = Router();
r.use(protect);

r.get('/', ah(async (req, res) => {
  const filter = { recipient: req.account._id, recipientType: req.accountType };
  const [items, unread] = await Promise.all([Notification.find(filter).sort({ dateSent: -1 }).limit(Number(req.query.limit) || 50).lean(), Notification.countDocuments({ ...filter, status: 'Unread' })]);
  res.json({ items, unread });
}));

r.patch('/:id/read', ah(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, recipient: req.account._id }, { status: 'Read' });
  res.json({ ok: true });
}));

r.post('/read-all', ah(async (req, res) => {
  await Notification.updateMany({ recipient: req.account._id, recipientType: req.accountType, status: 'Unread' }, { status: 'Read' });
  res.json({ ok: true });
}));

r.post('/broadcast', allow('admin'), ah(async (req, res) => {
  requireFields(req.body, ['audience', 'title', 'message']);
  const payload = { type: req.body.notificationType || 'Promotion', title: req.body.title, message: req.body.message, link: req.body.link, email: !!req.body.email };
  let sent = [];
  if (['members', 'all'].includes(req.body.audience)) sent = sent.concat(await notifyAllMembers(req.gymId, payload));
  if (['coaches', 'all'].includes(req.body.audience)) sent = sent.concat(await notifyAllCoaches(req.gymId, payload));
  if (['staff', 'all'].includes(req.body.audience)) sent = sent.concat(await notifyStaff(req.gymId, payload));
  if (!['members', 'coaches', 'staff', 'all'].includes(req.body.audience)) throw new ApiError(400, 'Unknown audience.');
  audit(req, 'Notification Management', `Sent "${req.body.title}" to ${sent.length} ${req.body.audience}`);
  res.json({ sent: sent.length });
}));

r.get('/sent', allow('admin'), ah(async (req, res) => {
  const rows = await Notification.aggregate([
    { $match: { gym: req.gymId, notificationType: { $in: ['Promotion', 'Announcement', 'Event', 'Reminder'] } } },
    { $group: { _id: { title: '$title', message: '$message' }, sentAt: { $max: '$dateSent' }, recipients: { $sum: 1 }, read: { $sum: { $cond: [{ $eq: ['$status', 'Read'] }, 1, 0] } } } },
    { $sort: { sentAt: -1 } },
    { $limit: 30 },
  ]);
  res.json(rows.map((x) => ({ title: x._id.title, message: x._id.message, sentAt: x.sentAt, recipients: x.recipients, read: x.read })));
}));

export default r;
