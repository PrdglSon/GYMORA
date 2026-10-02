import { useState } from 'react';
import { Box, Button, Card, CardContent, Checkbox, Chip, FormControlLabel, IconButton, Menu, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import Favorite from '@mui/icons-material/Favorite';
import MoreHoriz from '@mui/icons-material/MoreHoriz';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import PushPinOutlined from '@mui/icons-material/PushPinOutlined';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import api, { errMsg, fileUrl } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../context/SocketContext';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Grid, Section, StatCard, StatusChip, UserAvatar, Empty, Headline, ConfirmDialog } from '../../components/ui';
import { ago } from '../../utils/format';
import { brand } from '../../theme';

const POST_TAGS = ['Progress', 'Nutrition', 'Questions', 'Announcements', 'Promotions', 'Events'];
const STAFF_TAGS = ['Announcements', 'Promotions', 'Events'];
const TYPE_LABEL = { Member: 'Member', Coach: 'Coach', StaffAdmin: 'Staff' };
const TYPE_BG = { Member: brand.fill, Coach: brand.purpleSoft, StaffAdmin: brand.yellowSoft };

function Post({ p, me, staff, onChange, onRemoved, onReload }) {
  const toast = useToast();
  const [comment, setComment] = useState('');
  const [menu, setMenu] = useState(null);
  const [del, setDel] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const mine = String(p.author._id) === String(me?._id);
  const hidden = p.status === 'Hidden';

  const like = async () => {
    try {
      const { data } = await api.post(`/community/posts/${p._id}/like`);
      onChange({ ...p, likes: data.likes, liked: data.liked });
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };
  const send = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      const { data } = await api.post(`/community/posts/${p._id}/comments`, { content: comment.trim() });
      setComment('');
      setShowAll(true);
      onChange(data);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };
  const moderate = async (body, msg) => {
    setMenu(null);
    try {
      await api.patch(`/community/posts/${p._id}`, body);
      toast(msg);
      onReload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };
  const remove = async () => {
    try {
      await api.delete(`/community/posts/${p._id}`);
      setDel(false);
      onRemoved(p._id);
      toast('Post deleted');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };
  const comments = showAll ? p.comments : p.comments.slice(-2);

  return (
    <Card sx={{ opacity: hidden ? 0.6 : 1, borderColor: p.pinned ? brand.yellow : undefined }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Stack direction="row" spacing={1.2} alignItems="center">
            <UserAvatar name={p.author.name} />
            <Box>
              <Typography variant="body2" fontWeight={700}>
                {p.author.name}
                <Chip size="small" label={TYPE_LABEL[p.author.type] || p.author.type} sx={{ ml: 0.75, bgcolor: TYPE_BG[p.author.type] || brand.fill }} />
              </Typography>
              <Typography variant="caption" color="text.secondary">{ago(p.datePosted)} · #{p.tag}</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {p.pinned && <Chip size="small" icon={<PushPinOutlined sx={{ fontSize: 14 }} />} label="Pinned" sx={{ bgcolor: brand.yellowSoft, color: brand.yellowInk }} />}
            {hidden && <StatusChip label="Hidden" color="red" />}
            {(staff || mine) && <IconButton size="small" onClick={(e) => setMenu(e.currentTarget)} aria-label="Post options"><MoreHoriz /></IconButton>}
          </Stack>
          <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
            {staff && <MenuItem onClick={() => moderate({ pinned: !p.pinned }, p.pinned ? 'Post unpinned' : 'Post pinned')}>{p.pinned ? 'Unpin' : 'Pin to top'}</MenuItem>}
            {staff && <MenuItem onClick={() => moderate({ status: hidden ? 'Visible' : 'Hidden' }, hidden ? 'Post is visible again' : 'Post hidden from members')}>{hidden ? 'Show post' : 'Hide post'}</MenuItem>}
            <MenuItem onClick={() => { setMenu(null); setDel(true); }} sx={{ color: brand.red }}>Delete</MenuItem>
          </Menu>
        </Stack>
        <Typography sx={{ my: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{p.content}</Typography>
        {p.image && <Box component="img" src={fileUrl(p.image)} alt="" sx={{ width: '100%', maxHeight: 380, objectFit: 'cover', borderRadius: 2, mb: 1 }} />}
        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" variant={p.liked ? 'contained' : 'outlined'} color={p.liked ? 'secondary' : 'inherit'} startIcon={p.liked ? <Favorite /> : <FavoriteBorder />} onClick={like} aria-label={p.liked ? 'Unlike' : 'Like'}>{p.likes}</Button>
          <Button size="small" color="inherit" startIcon={<ChatBubbleOutline />} onClick={() => setShowAll(!showAll)} disabled={p.comments.length <= 2}>{p.comments.length}</Button>
        </Stack>
        {p.comments.length > 2 && !showAll && <Typography variant="caption" color="text.secondary" sx={{ cursor: 'pointer', display: 'block', mt: 1 }} onClick={() => setShowAll(true)}>View all {p.comments.length} comments</Typography>}
        {comments.map((c) => (
          <Box key={c._id} sx={{ mt: 1, p: 1, bgcolor: brand.fill, borderRadius: 2 }}>
            <Typography variant="body2"><b>{c.author.name}</b>{c.author.type !== 'Member' && <Box component="span" sx={{ color: 'text.secondary', fontSize: 12 }}> · {TYPE_LABEL[c.author.type]}</Box>} {c.content}</Typography>
            <Typography variant="caption" color="text.secondary">{ago(c.datePosted)}</Typography>
          </Box>
        ))}
        {!hidden && (
          <Stack component="form" direction="row" spacing={1} sx={{ mt: 1.5 }} onSubmit={send}>
            <TextField placeholder="Write a comment…" value={comment} onChange={(e) => setComment(e.target.value)} inputProps={{ maxLength: 300, 'aria-label': 'Comment' }} />
            <Button type="submit" variant="outlined" disabled={!comment.trim()}>Reply</Button>
          </Stack>
        )}
      </CardContent>
      <ConfirmDialog open={del} title="Delete this post?" message="This cannot be undone." confirmLabel="Delete" danger onClose={() => setDel(false)} onConfirm={remove} />
    </Card>
  );
}

export default function Community() {
  usePageTitle('Community', 'Connect. Share. Inspire.');
  const { account, role } = useAuth();
  const toast = useToast();
  const staff = ['admin', 'receptionist'].includes(role);
  const canAnnounce = staff || role === 'coach';
  const tags = POST_TAGS.filter((t) => canAnnounce || !STAFF_TAGS.includes(t));
  const [tag, setTag] = useState('All');
  const posts = useFetch('/community/posts', { params: tag === 'All' ? { limit: 50 } : { tag, limit: 50 }, initial: [] });
  const stats = useFetch(staff ? '/community/stats' : null);
  const empty = { content: '', tag: canAnnounce && staff ? 'Announcements' : 'Progress', image: null, pinned: false, email: false };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const reloadAll = () => {
    posts.reload();
    if (staff) stats.reload();
  };
  useSocketEvent('community:update', reloadAll);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.content.trim()) return;
    const fd = new FormData();
    fd.append('content', f.content.trim());
    fd.append('tag', f.tag);
    if (f.image) fd.append('image', f.image);
    if (staff && f.pinned) fd.append('pinned', 'true');
    if (STAFF_TAGS.includes(f.tag) && f.email) fd.append('email', 'true');
    setBusy(true);
    try {
      await api.post('/community/posts', fd);
      setF(empty);
      toast(STAFF_TAGS.includes(f.tag) ? 'Posted. Members were notified.' : 'Posted');
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const update = (p) => posts.setData((posts.data || []).map((x) => (x._id === p._id ? p : x)));
  const removed = (id) => {
    posts.setData((posts.data || []).filter((x) => x._id !== id));
    if (staff) stats.reload();
  };

  return (
    <Stack spacing={2}>
      {staff && stats.data && (
        <Grid cols={{ xs: 1, sm: 2, lg: 4 }}>
          <StatCard label="Total posts" value={stats.data.posts} />
          <StatCard label="Total likes" value={stats.data.likes} />
          <StatCard label="Comments" value={stats.data.comments} />
          <StatCard label="Members posting" value={stats.data.activeMembers} />
        </Grid>
      )}
      <Grid cols={{ xs: 1, md: '2fr 1fr' }} sx={{ alignItems: 'start' }}>
        <Stack spacing={2} sx={{ minWidth: 0 }}>
          <Card component="form" onSubmit={submit}>
            <CardContent>
              <Stack direction="row" spacing={1.5}>
                <UserAvatar name={account?.name} src={account?.avatarUrl} />
                <TextField multiline minRows={2} placeholder={staff ? 'Post an announcement, promo or event…' : 'Share your progress, a tip or a question…'} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} required inputProps={{ maxLength: 1000, 'aria-label': 'Post' }} />
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5, gap: 1, flexWrap: 'wrap' }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <TextField select size="small" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} sx={{ width: 170 }} fullWidth={false} inputProps={{ 'aria-label': 'Topic' }}>
                    {tags.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </TextField>
                  <Button component="label" size="small" startIcon={<ImageOutlined />}>
                    {f.image ? f.image.name.slice(0, 18) : 'Photo'}
                    <input hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setF({ ...f, image: e.target.files[0] || null })} />
                  </Button>
                  {staff && <FormControlLabel control={<Checkbox size="small" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} />} label="Pin" />}
                  {STAFF_TAGS.includes(f.tag) && <FormControlLabel control={<Checkbox size="small" checked={f.email} onChange={(e) => setF({ ...f, email: e.target.checked })} />} label="Also email members" />}
                </Stack>
                <Button type="submit" variant="contained" disabled={busy || !f.content.trim()}>Post</Button>
              </Stack>
              {STAFF_TAGS.includes(f.tag) && <Typography variant="caption" color="text.secondary">All members get a notification for this post.</Typography>}
            </CardContent>
          </Card>
          <Tabs value={tag} onChange={(_, v) => setTag(v)} variant="scrollable" scrollButtons="auto">
            {['All', ...POST_TAGS].map((t) => <Tab key={t} value={t} label={t} />)}
          </Tabs>
          <DataState {...posts} onRetry={posts.reload}>
            <Stack spacing={2}>
              {(posts.data || []).map((p) => <Post key={p._id} p={p} me={account} staff={staff} onChange={update} onRemoved={removed} onReload={reloadAll} />)}
              {!posts.data?.length && <Empty>{tag === 'All' ? 'No posts yet. Be the first to share!' : `No ${tag} posts yet.`}</Empty>}
            </Stack>
          </DataState>
        </Stack>
        <Stack spacing={2}>
          <Card sx={{ bgcolor: brand.yellowSoft, borderColor: brand.yellow }}>
            <CardContent>
              <Headline line1="Stronger together." accent="Better" rest="every day." size={22} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Share progress, ask questions and cheer each other on.</Typography>
            </CardContent>
          </Card>
          <Section title="Community rules">
            <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'text.secondary', '& li': { mb: 0.5 } }}>
              <li>Be kind and encouraging.</li>
              <li>No selling or spam.</li>
              <li>Keep health advice safe; ask a coach when unsure.</li>
              <li>Report problems through Help &amp; Reports or the front desk.</li>
            </Box>
          </Section>
          {canAnnounce && (
            <Section title="Topics">
              <Typography variant="body2" color="text.secondary">Announcements, Promotions and Events notify every member. {staff ? 'Staff can pin and hide posts.' : ''}</Typography>
            </Section>
          )}
        </Stack>
      </Grid>
    </Stack>
  );
}
