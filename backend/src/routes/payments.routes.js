import { Router } from 'express';
import { Payment, PosTransaction, Membership, nextCode } from '../models/index.js';
import { protect, allow, STAFF } from '../middleware/auth.js';
import { ah, ApiError, requireFields, notFound, paging, escapeRegex } from '../utils/http.js';
import { settlePayment, cancelMembership } from '../utils/membership.js';
import { notify, toMember } from '../utils/notify.js';
import { audit } from '../utils/audit.js';
import { isPersonName } from '../utils/validators.js';
import { emitToStaff } from '../utils/socket.js';
import { startOfDay, addDays, endOfDay } from '../utils/dates.js';

const r = Router();
r.use(protect, allow(...STAFF));

r.get('/', ah(async (req, res) => {
  const { limit, skip } = paging(req.query, 100);
  const filter = { gym: req.gymId };
  if (req.query.paymentType) filter.paymentType = req.query.paymentType;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.member) filter.member = req.query.member;
  if (req.query.from || req.query.to) {
    const range = {};
    if (req.query.from) range.$gte = startOfDay(new Date(`${req.query.from}T00:00:00`));
    if (req.query.to) range.$lte = endOfDay(new Date(`${req.query.to}T00:00:00`));
    filter.$and = [{ $or: [{ paymentDate: range }, { paymentDate: null, createdAt: range }] }];
  }
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ payerName: rx }, { receiptNo: rx }, { referenceNumber: rx }];
  }
  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('member', 'memberCode').populate('recordedBy', 'firstName lastName').lean(),
    Payment.countDocuments(filter),
  ]);
  res.json({ items, total });
}));

r.get('/summary', ah(async (req, res) => {
  const since = addDays(startOfDay(), -29);
  const [rows, unpaid, pos] = await Promise.all([
    Payment.aggregate([{ $match: { gym: req.gymId, status: 'Paid', paymentDate: { $gte: since } } }, { $group: { _id: '$paymentType', total: { $sum: '$amount' } } }]),
    Payment.aggregate([{ $match: { gym: req.gymId, status: 'Unpaid' } }, { $group: { _id: null, total: { $sum: '$amount' }, n: { $sum: 1 } } }]),
    PosTransaction.aggregate([{ $match: { gym: req.gymId, status: 'Completed', transactionDate: { $gte: since } } }, { $group: { _id: null, total: { $sum: '$productAmount' } } }]),
  ]);
  const by = Object.fromEntries(rows.map((x) => [x._id, x.total]));
  const retail = pos[0]?.total || 0;
  res.json({
    membership30: by.Membership || 0,
    walkin30: by['Walk-in'] || 0,
    other30: by.Other || 0,
    retail30: retail,
    revenue30: (by.Membership || 0) + (by['Walk-in'] || 0) + (by.Other || 0) + retail,
    unpaidTotal: unpaid[0]?.total || 0,
    unpaidCount: unpaid[0]?.n || 0,
  });
}));

r.post('/', ah(async (req, res) => {
  requireFields(req.body, ['payerName', 'amount', 'description']);
  if (!isPersonName(req.body.payerName)) throw new ApiError(400, 'Payer name can only contain letters.');
  const p = await Payment.create({ gym: req.gymId, receiptNo: await nextCode(req.gymId, 'receipt'), paymentType: 'Other', payerName: req.body.payerName, member: req.body.memberId || undefined, description: req.body.description, amount: Number(req.body.amount), paymentMethod: req.body.paymentMethod || 'Cash', referenceNumber: req.body.referenceNumber, status: 'Paid', paymentDate: new Date(), recordedBy: req.account._id });
  audit(req, 'Payment and Billing', `Recorded ${p.receiptNo}: ${p.description} ₱${p.amount}`);
  emitToStaff(req.gymId, 'payments:update', {});
  res.status(201).json(p);
}));

r.post('/:id/settle', ah(async (req, res) => {
  const p = await Payment.findOne({ _id: req.params.id, gym: req.gymId });
  if (!p) throw notFound('Payment');
  if (p.status !== 'Unpaid') throw new ApiError(409, 'This payment is not unpaid.');
  await settlePayment(p, { method: req.body.paymentMethod || 'Cash', referenceNumber: req.body.referenceNumber, recordedBy: req.account._id });
  if (p.member) await notify(toMember(p.member), { gym: req.gymId, type: 'Payment', title: 'Payment received', message: `${p.description}: ₱${p.amount} (${p.receiptNo}).`, link: '/member/payments', email: true });
  audit(req, 'Payment and Billing', `Marked ${p.receiptNo} as paid (₱${p.amount}, ${p.paymentMethod})`);
  emitToStaff(req.gymId, 'payments:update', {});
  res.json(p);
}));

r.patch('/:id', allow('admin'), ah(async (req, res) => {
  const p = await Payment.findOne({ _id: req.params.id, gym: req.gymId });
  if (!p) throw notFound('Payment');
  if (p.status === 'Void') throw new ApiError(400, 'A voided payment can no longer be edited.');
  if (p.posTransaction) throw new ApiError(400, 'This payment came from a POS sale. Edit or void the POS transaction instead.');
  const changes = [];
  if (req.body.amount !== undefined && req.body.amount !== '') {
    const amount = Number(req.body.amount);
    if (!(amount >= 0)) throw new ApiError(400, 'Enter a valid amount.');
    if (p.online?.checkoutId && amount !== p.amount) throw new ApiError(400, 'The amount of an online (PayMongo) payment cannot be changed.');
    if (amount !== p.amount) changes.push(`amount ₱${p.amount} → ₱${amount}`);
    p.amount = amount;
  }
  if (req.body.paymentDate) {
    const d = new Date(req.body.paymentDate);
    if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Payment date is not valid.');
    if (d > new Date()) throw new ApiError(400, 'Payment date cannot be in the future.');
    if (p.status !== 'Paid') throw new ApiError(400, 'Mark the payment as paid first.');
    changes.push(`date → ${d.toDateString()}`);
    p.paymentDate = d;
  }
  if (req.body.paymentMethod && p.status === 'Paid' && !p.online?.checkoutId) {
    if (!['Cash', 'GCash', 'Card', 'Other'].includes(req.body.paymentMethod)) throw new ApiError(400, 'Choose Cash, GCash, Card or Other.');
    if (req.body.paymentMethod !== p.paymentMethod) changes.push(`method ${p.paymentMethod} → ${req.body.paymentMethod}`);
    p.paymentMethod = req.body.paymentMethod;
  }
  if (req.body.referenceNumber !== undefined) p.referenceNumber = req.body.referenceNumber || undefined;
  if (req.body.description) p.description = String(req.body.description).slice(0, 200);
  await p.save();
  if (p.membership && req.body.amount !== undefined && req.body.amount !== '') await Membership.updateOne({ _id: p.membership }, { price: p.amount });
  audit(req, 'Payment and Billing', `Edited ${p.receiptNo}${changes.length ? `: ${changes.join(', ')}` : ''}`);
  emitToStaff(req.gymId, 'payments:update', {});
  res.json(p);
}));

r.post('/:id/void', allow('admin'), ah(async (req, res) => {
  const p = await Payment.findOne({ _id: req.params.id, gym: req.gymId });
  if (!p) throw notFound('Payment');
  if (p.posTransaction) throw new ApiError(400, 'Void the POS transaction instead.');
  if (p.status === 'Void') throw new ApiError(409, 'Already void.');
  p.status = 'Void';
  await p.save();
  if (p.paymentType === 'Membership' && p.membership) await cancelMembership(p.membership);
  audit(req, 'Payment and Billing', `Voided ${p.receiptNo}${req.body.reason ? `: ${req.body.reason}` : ''}`);
  res.json(p);
}));

export default r;
