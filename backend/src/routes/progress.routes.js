import { Router } from 'express';
import { FitnessProgress, Member } from '../models/index.js';
import { protect, allow, STAFF } from '../middleware/auth.js';
import { ah, ApiError, notFound, pick } from '../utils/http.js';
import { bmi, evaluateBadges } from '../utils/rules.js';
import { notify, toMember } from '../utils/notify.js';
import { audit } from '../utils/audit.js';
import { clientIdsOf } from './coaches.routes.js';

const r = Router();
r.use(protect);
const FIELDS = ['recordDate', 'weight', 'bodyFat', 'remarks', 'program'];

function validate(body) {
  if (body.weight == null && body.bodyFat == null) throw new ApiError(400, 'Enter at least a weight or body fat value.');
}

r.get('/me', allow('member'), ah(async (req, res) => {
  res.json(await FitnessProgress.find({ member: req.member._id }).sort({ recordDate: 1 }).populate('coach', 'firstName lastName').lean());
}));

r.post('/me', allow('member'), ah(async (req, res) => {
  validate(req.body);
  const rec = await FitnessProgress.create({ gym: req.gymId, member: req.member._id, recordedByType: 'Member', recordedBy: req.member._id, ...pick(req.body, FIELDS), bmi: bmi(req.body.weight, req.member.heightCm) });
  evaluateBadges(req.member).catch(() => {});
  res.status(201).json(rec);
}));

async function access(req, memberId) {
  const member = await Member.findOne({ _id: memberId, gym: req.gymId });
  if (!member) throw notFound('Member');
  if (req.role === 'coach') {
    const { ids } = await clientIdsOf(req.coach);
    if (!ids.includes(String(member._id))) throw new ApiError(403, 'This member is not your client.');
  }
  return member;
}

r.get('/member/:memberId', allow('coach', ...STAFF), ah(async (req, res) => {
  await access(req, req.params.memberId);
  res.json(await FitnessProgress.find({ member: req.params.memberId }).sort({ recordDate: 1 }).populate('coach', 'firstName lastName').lean());
}));

r.post('/member/:memberId', allow('coach', ...STAFF), ah(async (req, res) => {
  validate(req.body);
  const member = await access(req, req.params.memberId);
  const rec = await FitnessProgress.create({ gym: req.gymId, member: member._id, coach: req.coach?._id, recordedByType: req.accountType, recordedBy: req.account._id, ...pick(req.body, FIELDS), bmi: bmi(req.body.weight, member.heightCm) });
  await notify(toMember(member), { gym: req.gymId, type: 'Progress', title: 'New fitness assessment', message: `${req.account.firstName} logged your progress.`, link: '/member/progress' });
  evaluateBadges(member).catch(() => {});
  audit(req, 'Fitness Progress Monitoring', `Logged assessment for ${member.memberCode}`);
  res.status(201).json(rec);
}));

r.delete('/:id', ah(async (req, res) => {
  const rec = await FitnessProgress.findOne({ _id: req.params.id, gym: req.gymId });
  if (!rec) throw notFound('Record');
  if (req.role !== 'admin' && String(rec.recordedBy) !== String(req.account._id)) throw new ApiError(403, 'You can only delete records you created.');
  await rec.deleteOne();
  res.json({ ok: true });
}));

export default r;
