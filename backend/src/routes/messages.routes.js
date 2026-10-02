import { Router } from 'express';
import { Message, Coach, Member, Enrollment, FitnessProgram } from '../models/index.js';
import { protect, allow } from '../middleware/auth.js';
import { ah, ApiError, requireFields, notFound } from '../utils/http.js';
import { notify, toMember, toCoach } from '../utils/notify.js';
import { fullName } from '../utils/format.js';
import { clientIdsOf } from './coaches.routes.js';

const r = Router();
r.use(protect, allow('coach', 'member'));

async function coachesForMember(member) {
  const programs = await Enrollment.find({ member: member._id, status: 'Active' }).distinct('program');
  const coachIds = await FitnessProgram.find({ _id: { $in: programs } }).distinct('coach');
  if (member.assignedCoach) coachIds.push(member.assignedCoach);
  return [...new Set(coachIds.filter(Boolean).map(String))];
}

async function pair(req, otherId) {
  if (req.coach) {
    const { ids } = await clientIdsOf(req.coach);
    if (!ids.includes(String(otherId))) throw new ApiError(403, 'This member is not your client.');
    const member = await Member.findById(otherId);
    if (!member) throw notFound('Member');
    return { coach: req.coach, member, senderType: 'Coach', to: toMember(member) };
  }
  if (!(await coachesForMember(req.member)).includes(String(otherId))) throw new ApiError(403, 'You can message your own coaches only.');
  const coach = await Coach.findById(otherId);
  if (!coach) throw notFound('Coach');
  return { coach, member: req.member, senderType: 'Member', to: toCoach(coach) };
}

r.get('/threads', ah(async (req, res) => {
  let others;
  if (req.coach) {
    const { ids } = await clientIdsOf(req.coach);
    others = (await Member.find({ _id: { $in: ids } }).select('firstName lastName avatarUrl memberCode')).map((m) => ({ id: m._id, name: fullName(m), avatarUrl: m.avatarUrl, sub: m.memberCode }));
  } else {
    others = (await Coach.find({ _id: { $in: await coachesForMember(req.member) } }).select('firstName lastName avatarUrl certification')).map((c) => ({ id: c._id, name: fullName(c), avatarUrl: c.avatarUrl, sub: c.certification }));
  }
  const key = req.coach ? 'member' : 'coach';
  const msgs = await Message.find(req.coach ? { coach: req.coach._id } : { member: req.member._id }).sort({ createdAt: -1 }).lean();
  const out = others.map((o) => {
    const mine = msgs.filter((m) => String(m[key]) === String(o.id));
    return { ...o, last: mine[0] || null, unread: mine.filter((m) => m.senderType !== req.accountType && !m.readAt).length };
  });
  out.sort((a, b) => new Date(b.last?.createdAt || 0) - new Date(a.last?.createdAt || 0));
  res.json(out);
}));

r.get('/:otherId', ah(async (req, res) => {
  const p = await pair(req, req.params.otherId);
  const filter = { coach: p.coach._id, member: p.member._id };
  await Message.updateMany({ ...filter, senderType: { $ne: p.senderType }, readAt: null }, { readAt: new Date() });
  res.json(await Message.find(filter).sort({ createdAt: 1 }).limit(300).lean());
}));

r.post('/:otherId', ah(async (req, res) => {
  requireFields(req.body, ['content']);
  const p = await pair(req, req.params.otherId);
  const msg = await Message.create({ gym: req.gymId, coach: p.coach._id, member: p.member._id, senderType: p.senderType, content: String(req.body.content).slice(0, 1000) });
  await notify(p.to, { gym: req.gymId, type: 'Message', title: `Message from ${req.account.firstName}`, message: String(req.body.content).slice(0, 100), link: p.senderType === 'Coach' ? '/member/messages' : '/coach/messages' });
  res.status(201).json(msg);
}));

export default r;
