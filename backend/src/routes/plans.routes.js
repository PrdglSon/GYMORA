import { Router } from 'express';
import { MembershipPlan, Member } from '../models/index.js';
import { protect, allow } from '../middleware/auth.js';
import { ah, requireFields, pick, notFound, ApiError } from '../utils/http.js';
import { audit } from '../utils/audit.js';

const r = Router();
r.use(protect);
const FIELDS = ['planName', 'description', 'price', 'duration', 'isStudentPlan', 'highlight', 'status', 'sortOrder'];

r.get('/', ah(async (req, res) => {
  const filter = { gym: req.gymId };
  if (!['admin', 'receptionist'].includes(req.role)) filter.status = 'Active';
  res.json(await MembershipPlan.find(filter).sort({ sortOrder: 1, price: 1 }));
}));

r.post('/', allow('admin'), ah(async (req, res) => {
  requireFields(req.body, ['planName', 'price', 'duration']);
  const plan = await MembershipPlan.create({ gym: req.gymId, ...pick(req.body, FIELDS) });
  audit(req, 'Membership Plan Administration', `Created plan ${plan.planName} (₱${plan.price})`);
  res.status(201).json(plan);
}));

r.patch('/:id', allow('admin'), ah(async (req, res) => {
  const plan = await MembershipPlan.findOne({ _id: req.params.id, gym: req.gymId });
  if (!plan) throw notFound('Plan');
  const before = plan.price;
  Object.assign(plan, pick(req.body, FIELDS));
  await plan.save();
  audit(req, 'Membership Plan Administration', `Updated plan ${plan.planName}${before !== plan.price ? ` price ₱${before} → ₱${plan.price}` : ''}`);
  res.json(plan);
}));

r.delete('/:id', allow('admin'), ah(async (req, res) => {
  const plan = await MembershipPlan.findOne({ _id: req.params.id, gym: req.gymId });
  if (!plan) throw notFound('Plan');
  if (await Member.exists({ 'current.plan': plan._id })) throw new ApiError(409, 'Members are on this plan. Set it to Inactive instead of deleting it.');
  await plan.deleteOne();
  audit(req, 'Membership Plan Administration', `Deleted plan ${plan.planName}`);
  res.json({ ok: true });
}));

export default r;
