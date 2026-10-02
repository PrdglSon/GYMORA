import { Router } from 'express';
import { Equipment } from '../models/index.js';
import { protect, allow, STAFF } from '../middleware/auth.js';
import { ah, requireFields, pick, notFound } from '../utils/http.js';
import { audit } from '../utils/audit.js';
import { addDays } from '../utils/dates.js';

const r = Router();
r.use(protect);
const FIELDS = ['equipmentName', 'code', 'category', 'location', 'status', 'purchaseDate', 'lastServicedAt', 'nextServiceAt', 'notes'];
const byName = (req) => `${req.account.firstName} ${req.account.lastName}`;

r.get('/', ah(async (req, res) => {
  const filter = { gym: req.gymId };
  if (req.query.status) filter.status = req.query.status;
  const items = await Equipment.find(filter).sort({ status: 1, equipmentName: 1 }).lean();
  const soon = addDays(new Date(), 7);
  res.json(items.map((e) => ({ ...e, serviceDue: !!e.nextServiceAt && new Date(e.nextServiceAt) <= soon })));
}));

r.post('/', allow('admin'), ah(async (req, res) => {
  requireFields(req.body, ['equipmentName']);
  const e = await Equipment.create({ gym: req.gymId, ...pick(req.body, FIELDS), maintenanceLog: [{ action: 'Added to equipment list', byName: byName(req) }] });
  audit(req, 'Equipment Maintenance', `Added ${e.equipmentName}`);
  res.status(201).json(e);
}));

r.patch('/:id', allow(...STAFF), ah(async (req, res) => {
  const e = await Equipment.findOne({ _id: req.params.id, gym: req.gymId });
  if (!e) throw notFound('Equipment');
  const before = e.status;
  Object.assign(e, pick(req.body, req.role === 'admin' ? FIELDS : ['status', 'notes', 'lastServicedAt', 'nextServiceAt']));
  if (req.body.logNote || before !== e.status) e.maintenanceLog.push({ action: req.body.logNote || `Status: ${before} → ${e.status}`, byName: byName(req) });
  await e.save();
  audit(req, 'Equipment Maintenance', `${e.equipmentName}: ${req.body.logNote || e.status}`);
  res.json(e);
}));

r.delete('/:id', allow('admin'), ah(async (req, res) => {
  const e = await Equipment.findOneAndDelete({ _id: req.params.id, gym: req.gymId });
  if (!e) throw notFound('Equipment');
  audit(req, 'Equipment Maintenance', `Removed ${e.equipmentName}`);
  res.json({ ok: true });
}));

export default r;
