import { Router } from 'express';
import { GcashEntry } from '../models/index.js';
import { protect, allow, STAFF } from '../middleware/auth.js';
import { ah, ApiError, requireFields, notFound } from '../utils/http.js';
import { audit } from '../utils/audit.js';
import { monthRange } from '../utils/month.js';
import { startOfDay, addDays } from '../utils/dates.js';
import { capitalizeName } from '../utils/validators.js';

const r = Router();
r.use(protect, allow(...STAFF));

function clean(body) {
  const out = {};
  if (body.date !== undefined) {
    const d = new Date(body.date);
    if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Choose a valid date.');
    if (startOfDay(d) > startOfDay()) throw new ApiError(400, 'The date cannot be in the future.');
    out.date = startOfDay(d);
  }
  if (body.amount !== undefined) {
    const amount = Math.round(Number(body.amount) * 100) / 100;
    if (!(amount > 0)) throw new ApiError(400, 'Enter a GCash amount greater than zero.');
    out.amount = amount;
  }
  if (body.referenceNumber !== undefined) out.referenceNumber = String(body.referenceNumber || '').trim().slice(0, 60) || undefined;
  if (body.payerName !== undefined) out.payerName = capitalizeName(String(body.payerName || '').trim().slice(0, 120)) || undefined;
  if (body.note !== undefined) out.note = String(body.note || '').trim().slice(0, 200) || undefined;
  return out;
}

r.get('/', ah(async (req, res) => {
  let start;
  let end;
  if (req.query.date) {
    const d = new Date(req.query.date);
    if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Choose a valid date.');
    start = startOfDay(d);
    end = addDays(start, 1);
  } else {
    const m = monthRange(req.query.month);
    start = m.start;
    end = m.end;
  }
  const items = await GcashEntry.find({ gym: req.gymId, date: { $gte: start, $lt: end } }).sort({ date: -1, createdAt: -1 }).lean();
  res.json({ total: Math.round(items.reduce((a, x) => a + x.amount, 0) * 100) / 100, items });
}));

r.post('/', ah(async (req, res) => {
  requireFields(req.body, ['date', 'amount']);
  const e = await GcashEntry.create({ gym: req.gymId, ...clean(req.body), recordedBy: req.account._id, recordedByName: `${req.account.firstName} ${req.account.lastName}` });
  audit(req, 'Payment and Billing', `GCash tally: ₱${e.amount}${e.referenceNumber ? ` (ref ${e.referenceNumber})` : ''} on ${e.date.toDateString()}`);
  res.status(201).json(e);
}));

r.patch('/:id', ah(async (req, res) => {
  const e = await GcashEntry.findOne({ _id: req.params.id, gym: req.gymId });
  if (!e) throw notFound('GCash entry');
  if (req.role !== 'admin' && startOfDay(e.date) < startOfDay()) throw new ApiError(403, 'Only the administrator can change GCash entries from previous days.');
  const before = e.amount;
  Object.assign(e, clean(req.body));
  await e.save();
  audit(req, 'Payment and Billing', `Edited GCash tally entry: ₱${before} → ₱${e.amount}`);
  res.json(e);
}));

r.delete('/:id', ah(async (req, res) => {
  const e = await GcashEntry.findOne({ _id: req.params.id, gym: req.gymId });
  if (!e) throw notFound('GCash entry');
  if (req.role !== 'admin' && startOfDay(e.date) < startOfDay()) throw new ApiError(403, 'Only the administrator can delete GCash entries from previous days.');
  await e.deleteOne();
  audit(req, 'Payment and Billing', `Deleted GCash tally entry ₱${e.amount} (${e.date.toDateString()})`);
  res.json({ ok: true });
}));

export default r;
