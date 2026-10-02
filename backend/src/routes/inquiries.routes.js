import { Router } from 'express';
import { Inquiry, nextCode } from '../models/index.js';
import { protect, allow, STAFF } from '../middleware/auth.js';
import { ah, requireFields, pick, notFound, paging } from '../utils/http.js';
import { notify, notifyStaff } from '../utils/notify.js';
import { audit } from '../utils/audit.js';

const r = Router();
r.use(protect);

r.post('/', allow('member', 'coach'), ah(async (req, res) => {
  requireFields(req.body, ['subject', 'message']);
  const inq = await Inquiry.create({
    gym: req.gymId, inquiryNo: await nextCode(req.gymId, 'inquiry'), inquiryType: 'Support Request', senderType: req.accountType, sender: req.account._id, senderModel: req.accountType,
    fullName: `${req.account.firstName} ${req.account.lastName}`, contact: req.account.email, subject: req.body.subject, message: req.body.message,
  });
  await notifyStaff(req.gymId, { type: 'Inquiry', title: 'New support request', message: `${inq.fullName}: ${inq.subject}`, link: '/admin/support' });
  res.status(201).json(inq);
}));

r.get('/mine', ah(async (req, res) => res.json(await Inquiry.find({ gym: req.gymId, sender: req.account._id }).sort({ createdAt: -1 }).lean())));

r.get('/', allow(...STAFF), ah(async (req, res) => {
  const { limit, skip } = paging(req.query, 100);
  const filter = { gym: req.gymId };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.inquiryType) filter.inquiryType = req.query.inquiryType;
  const [items, total, counts] = await Promise.all([
    Inquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Inquiry.countDocuments(filter),
    Inquiry.aggregate([{ $match: { gym: req.gymId } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  res.json({ items, total, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
}));

r.patch('/:id', allow(...STAFF), ah(async (req, res) => {
  const inq = await Inquiry.findOne({ _id: req.params.id, gym: req.gymId });
  if (!inq) throw notFound('Inquiry');
  Object.assign(inq, pick(req.body, ['status', 'response']));
  if (req.body.response) {
    inq.respondedBy = req.account._id;
    inq.respondedAt = new Date();
  }
  await inq.save();
  if (inq.sender) await notify({ type: inq.senderModel, id: inq.sender }, { gym: req.gymId, type: 'Inquiry', title: `${inq.inquiryNo}: ${inq.status}`, message: inq.response || 'Your request was updated.', link: inq.senderModel === 'Member' ? '/member/help' : '/coach/help' });
  audit(req, 'Customer Support', `${inq.inquiryNo} → ${inq.status}`);
  res.json(inq);
}));

export default r;
