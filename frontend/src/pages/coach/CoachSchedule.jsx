import { useEffect, useState } from 'react';
import { Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle, Menu, MenuItem, Stack, TextField, Typography } from '@mui/material';
import dayjs from 'dayjs';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { usePageTitle } from '../../components/AppShell';
import { Grid, Section, StatCard, DataState, StatusChip, ConfirmDialog } from '../../components/ui';
import RosterDialog from '../../components/RosterDialog';
import { hhmm12 } from '../../utils/format';
import { brand } from '../../theme';

const STATE_COLOR = { Upcoming: brand.orange, 'In Progress': brand.purple, Completed: brand.green, Cancelled: brand.red };

function EditSession({ session, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ scheduleDate: '', startTime: '', endTime: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (session) setF({ scheduleDate: dayjs(session.scheduleDate).format('YYYY-MM-DD'), startTime: session.startTime, endTime: session.endTime });
  }, [session]);
  const submit = async (e) => {
    e.preventDefault();
    if (f.endTime <= f.startTime) return toast('End time must be after start time.', 'error');
    setBusy(true);
    try {
      await api.patch(`/programs/schedules/${session._id}`, { scheduleDate: dayjs(f.scheduleDate).startOf('day').toISOString(), startTime: f.startTime, endTime: f.endTime });
      toast('Session updated');
      onSaved();
      onClose();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={!!session} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ component: 'form', onSubmit: submit }}>
      <DialogTitle>Edit session</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">{session?.programName}</Typography>
          <TextField type="date" label="Date" value={f.scheduleDate} onChange={(e) => setF({ ...f, scheduleDate: e.target.value })} InputLabelProps={{ shrink: true }} required />
          <Grid cols={{ xs: 2 }}>
            <TextField type="time" label="Start" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} InputLabelProps={{ shrink: true }} required />
            <TextField type="time" label="End" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} InputLabelProps={{ shrink: true }} required />
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={busy}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function CoachSchedule() {
  usePageTitle('My Schedule', 'View and manage your training sessions and classes.');
  const toast = useToast();
  const [offset, setOffset] = useState(0);
  const monday = dayjs().startOf('day').subtract((dayjs().day() + 6) % 7, 'day').add(offset * 7, 'day');
  const s = useFetch('/programs/sessions', { params: { mine: 'true', from: monday.format('YYYY-MM-DD'), days: 7 }, initial: [] });
  const clients = useFetch('/coaches/me/clients', { initial: [] });
  const [menu, setMenu] = useState(null);
  const [roster, setRoster] = useState(null);
  const [edit, setEdit] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const list = s.data || [];
  const active = list.filter((x) => x.status !== 'Cancelled');
  const hours = active.reduce((a, x) => a + (x.durationMins || 0), 0) / 60;
  const cl = clients.data || [];
  const weekActive = cl.filter((c) => c.lastVisitAt && dayjs(c.lastVisitAt).isAfter(dayjs().subtract(7, 'day'))).length;

  const act = async () => {
    const { kind, session } = confirm;
    setBusy(true);
    try {
      if (kind === 'delete') await api.delete(`/programs/schedules/${session._id}`);
      else await api.patch(`/programs/schedules/${session._id}`, { status: kind === 'cancel' ? 'Cancelled' : 'Scheduled' });
      toast(kind === 'delete' ? 'Session deleted' : kind === 'cancel' ? 'Session cancelled. Enrolled members were notified.' : 'Session restored');
      setConfirm(null);
      s.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const pick = (kind) => {
    const session = menu.session;
    setMenu(null);
    if (kind === 'roster') setRoster({ _id: session.programId, programName: session.programName });
    else if (kind === 'edit') setEdit(session);
    else setConfirm({ kind, session });
  };
  const confirmText = {
    cancel: ['Cancel this session?', 'Enrolled members will be notified that this session is cancelled.', 'Cancel session'],
    restore: ['Restore this session?', 'The session will be shown as scheduled again.', 'Restore'],
    delete: ['Delete this session?', 'This removes the session from the calendar. This cannot be undone.', 'Delete'],
  }[confirm?.kind] || ['', '', ''];

  return (
    <Stack spacing={2}>
      <Grid cols={{ xs: 1, sm: 2, lg: 4 }}>
        <StatCard label="Sessions this week" value={active.length} sub={`${list.length - active.length} cancelled`} />
        <StatCard label="Total clients" value={cl.length} />
        <StatCard label="Coaching hours" value={hours.toFixed(1)} sub="scheduled this week" />
        <StatCard label="Weekly attendance rate" value={`${cl.length ? Math.round((weekActive / cl.length) * 100) : 0}%`} sub="clients who visited in the last 7 days" />
      </Grid>
      <Section title={`Week of ${monday.format('MMM D')} – ${monday.add(6, 'day').format('MMM D, YYYY')}`}
        action={<Stack direction="row" spacing={1}><Button size="small" variant="outlined" onClick={() => setOffset(offset - 1)}>Prev</Button><Button size="small" variant="outlined" onClick={() => setOffset(0)} disabled={offset === 0}>This week</Button><Button size="small" variant="outlined" onClick={() => setOffset(offset + 1)}>Next</Button></Stack>}>
        <DataState {...s} onRetry={s.reload}>
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(130px, 1fr))', gap: 1, minWidth: 920 }}>
              {Array.from({ length: 7 }, (_, i) => monday.add(i, 'day')).map((d) => {
                const today = d.isSame(dayjs(), 'day');
                const items = list.filter((x) => dayjs(x.scheduleDate).isSame(d, 'day'));
                return (
                  <Box key={d.format('YYYY-MM-DD')} sx={{ border: 1, borderColor: today ? brand.yellow : 'divider', bgcolor: today ? brand.yellowSoft : '#fff', borderRadius: 2, p: 1, minHeight: 200 }}>
                    <Typography variant="body2" fontWeight={800}>{d.format('ddd')} <Box component="span" sx={{ color: 'text.secondary' }}>{d.format('D')}</Box></Typography>
                    {items.map((x) => (
                      <ButtonBase key={x._id} onClick={(e) => setMenu({ anchor: e.currentTarget, session: x })} sx={{ display: 'block', width: '100%', textAlign: 'left', mt: 1, p: 1, bgcolor: '#fff', borderLeft: `3px solid ${STATE_COLOR[x.state] || brand.orange}`, borderRadius: 1.5, boxShadow: `0 1px 0 ${brand.line}`, opacity: x.status === 'Cancelled' ? 0.6 : 1 }}>
                        <Typography variant="caption" fontWeight={700} display="block">{hhmm12(x.startTime)} – {hhmm12(x.endTime)}</Typography>
                        <Typography variant="body2" fontWeight={700} sx={{ textDecoration: x.status === 'Cancelled' ? 'line-through' : 'none' }}>{x.programName}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">{x.enrolled}/{x.capacity} · {x.durationMins}m</Typography>
                        <StatusChip label={x.state} sx={{ mt: 0.5 }} />
                      </ButtonBase>
                    ))}
                    {!items.length && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>Rest day</Typography>}
                  </Box>
                );
              })}
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>Click a session to view its roster, reschedule, cancel or delete it.</Typography>
        </DataState>
      </Section>
      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => pick('roster')}>View roster</MenuItem>
        {menu?.session?.status !== 'Cancelled' && <MenuItem onClick={() => pick('edit')}>Reschedule</MenuItem>}
        {menu?.session?.status === 'Cancelled' ? <MenuItem onClick={() => pick('restore')}>Restore session</MenuItem> : <MenuItem onClick={() => pick('cancel')}>Cancel session</MenuItem>}
        <MenuItem onClick={() => pick('delete')} sx={{ color: brand.red }}>Delete</MenuItem>
      </Menu>
      <RosterDialog open={!!roster} program={roster} onClose={() => setRoster(null)} />
      <EditSession session={edit} onClose={() => setEdit(null)} onSaved={s.reload} />
      <ConfirmDialog open={!!confirm} title={confirmText[0]} message={confirmText[1]} confirmLabel={confirmText[2]} danger={confirm?.kind !== 'restore'} busy={busy} onClose={() => setConfirm(null)} onConfirm={act} />
    </Stack>
  );
}
