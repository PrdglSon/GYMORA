import { Router } from 'express';
import { Expense, EXPENSE_CATEGORIES } from '../models/index.js';
import { protect, allow } from '../middleware/auth.js';
import { ah, ApiError, requireFields, notFound } from '../utils/http.js';
import { audit } from '../utils/audit.js';
import { monthRange } from '../utils/month.js';
import { startOfDay } from '../utils/dates.js';

const r = Router();
r.use(protect, allow('admin'));

const PAID_WITH = ['Cash', 'GCash', 'Bank transfer', 'Card', 'Other'];

function clean(body, current = {}) {
  const out = {};
  if (body.date !== undefined) {
    const d = new Date(body.date);
    if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Choose a valid date.');
    if (startOfDay(d) > startOfDay()) throw new ApiError(400, 'The expense date cannot be in the future.');
    out.date = startOfDay(d);
  }
  if (body.amount !== undefined) {
    const amount = Math.round(Number(body.amount) * 100) / 100;
    if (!(amount > 0)) throw new ApiError(400, 'Enter an amount greater than zero.');
    out.amount = amount;
  }
  if (body.description !== undefined) {
    const text = String(body.description).trim();
    if (!text) throw new ApiError(400, 'Describe the expense, for example "Water jug refill".');
    out.description = text.slice(0, 200);
  }
  if (body.category !== undefined) out.category = EXPENSE_CATEGORIES.includes(body.category) ? body.category : 'Other';
  if (body.paidWith !== undefined) out.paidWith = PAID_WITH.includes(body.paidWith) ? body.paidWith : current.paidWith || 'Cash';
  return out;
}

r.get('/categories', (req, res) => res.json({ categories: EXPENSE_CATEGORIES, paidWith: PAID_WITH }));

r.get('/', ah(async (req, res) => {
  const m = monthRange(req.query.month);
  const items = await Expense.find({ gym: req.gymId, date: { $gte: m.start, $lt: m.end } }).sort({ date: -1, createdAt: -1 }).lean();
  res.json({ month: m.key, label: m.label, total: Math.round(items.reduce((a, x) => a + x.amount, 0) * 100) / 100, items });
}));

r.post('/', ah(async (req, res) => {
  requireFields(req.body, ['date', 'description', 'amount']);
  const e = await Expense.create({ gym: req.gymId, ...clean(req.body), recordedBy: req.account._id, recordedByName: `${req.account.firstName} ${req.account.lastName}` });
  audit(req, 'Reports', `Added expense: ${e.description} ₱${e.amount} (${e.date.toDateString()})`);
  res.status(201).json(e);
}));

r.patch('/:id', ah(async (req, res) => {
  const e = await Expense.findOne({ _id: req.params.id, gym: req.gymId });
  if (!e) throw notFound('Expense');
  Object.assign(e, clean(req.body, e));
  await e.save();
  audit(req, 'Reports', `Edited expense: ${e.description} ₱${e.amount}`);
  res.json(e);
}));

r.delete('/:id', ah(async (req, res) => {
  const e = await Expense.findOneAndDelete({ _id: req.params.id, gym: req.gymId });
  if (!e) throw notFound('Expense');
  audit(req, 'Reports', `Deleted expense: ${e.description} ₱${e.amount}`);
  res.json({ ok: true });
}));

export default r;
