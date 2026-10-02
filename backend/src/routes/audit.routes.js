import { Router } from 'express';
import { AuditLog } from '../models/index.js';
import { protect, allow } from '../middleware/auth.js';
import { ah, paging, escapeRegex } from '../utils/http.js';

const r = Router();
r.use(protect, allow('admin'));

r.get('/', ah(async (req, res) => {
  const { limit, skip } = paging(req.query, 100);
  const filter = { gym: req.gymId };
  if (req.query.module) filter.module = req.query.module;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ action: rx }, { actorName: rx }];
  }
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(`${req.query.from}T00:00:00`);
    if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999`);
  }
  const [items, total, modules] = await Promise.all([AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), AuditLog.countDocuments(filter), AuditLog.distinct('module', { gym: req.gymId })]);
  res.json({ items, total, modules });
}));

export default r;
