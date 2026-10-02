import { Router } from 'express';
import { CommunityPost } from '../models/index.js';
import { protect, allow, STAFF } from '../middleware/auth.js';
import { ah, ApiError, requireFields, notFound, paging } from '../utils/http.js';
import { notifyAllMembers, notify } from '../utils/notify.js';
import { upload, saveFile } from '../utils/upload.js';
import { evaluateBadges } from '../utils/rules.js';
import { audit } from '../utils/audit.js';
import { emitToGym } from '../utils/socket.js';

const r = Router();
r.use(protect);
const STAFF_TAGS = ['Announcements', 'Promotions', 'Events'];
const name = (req) => `${req.account.firstName} ${req.account.lastName}`;

function shape(p, me) {
  return {
    _id: p._id, content: p.content, image: p.image, tag: p.tag, pinned: p.pinned, status: p.status, datePosted: p.datePosted,
    author: { _id: p.author, name: p.authorName, type: p.authorType },
    likes: p.likes.length, liked: p.likes.some((id) => String(id) === String(me)),
    comments: p.comments.map((c) => ({ _id: c._id, content: c.content, datePosted: c.datePosted, author: { _id: c.author, name: c.authorName, type: c.authorType } })),
  };
}

r.get('/posts', ah(async (req, res) => {
  const { limit, skip } = paging(req.query, 30);
  const filter = { gym: req.gymId };
  if (!STAFF.includes(req.role)) filter.status = 'Visible';
  if (req.query.tag) filter.tag = req.query.tag;
  const posts = await CommunityPost.find(filter).sort({ pinned: -1, datePosted: -1 }).skip(skip).limit(limit);
  res.json(posts.map((p) => shape(p, req.account._id)));
}));

r.get('/stats', allow(...STAFF), ah(async (req, res) => {
  const posts = await CommunityPost.find({ gym: req.gymId }).select('likes comments authorType author').lean();
  res.json({
    posts: posts.length,
    likes: posts.reduce((a, p) => a + p.likes.length, 0),
    comments: posts.reduce((a, p) => a + p.comments.length, 0),
    activeMembers: new Set(posts.filter((p) => p.authorType === 'Member').map((p) => String(p.author))).size,
  });
}));

r.post('/posts', upload.single('image'), ah(async (req, res) => {
  requireFields(req.body, ['content']);
  const tag = req.body.tag || 'Progress';
  if (STAFF_TAGS.includes(tag) && req.role === 'member') throw new ApiError(403, 'Only staff and coaches can post announcements, promotions and events.');
  const post = await CommunityPost.create({
    gym: req.gymId, authorType: req.accountType, author: req.account._id, member: req.member?._id, authorName: name(req), content: req.body.content, tag,
    image: req.file ? await saveFile(req.file, 'posts') : undefined, pinned: STAFF.includes(req.role) && req.body.pinned === 'true',
  });
  if (STAFF_TAGS.includes(tag)) await notifyAllMembers(req.gymId, { type: 'Promotion', title: tag.replace(/s$/, ''), message: String(req.body.content).slice(0, 140), link: '/member/community', email: req.body.email === 'true' });
  if (req.member) evaluateBadges(req.member).catch(() => {});
  emitToGym(req.gymId, 'community:update', {});
  res.status(201).json(shape(post, req.account._id));
}));

r.post('/posts/:id/like', ah(async (req, res) => {
  const p = await CommunityPost.findOne({ _id: req.params.id, gym: req.gymId });
  if (!p) throw notFound('Post');
  const i = p.likes.findIndex((id) => String(id) === String(req.account._id));
  if (i >= 0) p.likes.splice(i, 1);
  else p.likes.push(req.account._id);
  await p.save();
  res.json({ likes: p.likes.length, liked: i < 0 });
}));

r.post('/posts/:id/comments', ah(async (req, res) => {
  requireFields(req.body, ['content']);
  const p = await CommunityPost.findOne({ _id: req.params.id, gym: req.gymId, status: 'Visible' });
  if (!p) throw notFound('Post');
  p.comments.push({ authorType: req.accountType, author: req.account._id, authorName: name(req), content: String(req.body.content).slice(0, 300) });
  await p.save();
  if (String(p.author) !== String(req.account._id)) await notify({ type: p.authorType, id: p.author }, { gym: req.gymId, type: 'Community', title: 'New comment on your post', message: `${req.account.firstName}: ${String(req.body.content).slice(0, 80)}`, link: p.authorType === 'Member' ? '/member/community' : p.authorType === 'Coach' ? '/coach/community' : '/admin/community' });
  res.status(201).json(shape(p, req.account._id));
}));

r.patch('/posts/:id', allow(...STAFF), ah(async (req, res) => {
  const p = await CommunityPost.findOne({ _id: req.params.id, gym: req.gymId });
  if (!p) throw notFound('Post');
  if (req.body.status) p.status = req.body.status === 'Hidden' ? 'Hidden' : 'Visible';
  if (req.body.pinned !== undefined) p.pinned = !!req.body.pinned;
  await p.save();
  audit(req, 'Community Hub', `${p.status === 'Hidden' ? 'Hid' : 'Updated'} a post`);
  res.json({ ok: true });
}));

r.delete('/posts/:id', ah(async (req, res) => {
  const p = await CommunityPost.findOne({ _id: req.params.id, gym: req.gymId });
  if (!p) throw notFound('Post');
  if (!STAFF.includes(req.role) && String(p.author) !== String(req.account._id)) throw new ApiError(403, 'You can only delete your own posts.');
  await p.deleteOne();
  if (STAFF.includes(req.role)) audit(req, 'Community Hub', 'Deleted a post');
  res.json({ ok: true });
}));

export default r;
