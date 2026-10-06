import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import dayjs from 'dayjs';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../context/SocketContext';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Empty, Grid, Section, StatusChip, UserAvatar } from '../../components/ui';
import { fday, hhmm12, isoDay } from '../../utils/format';
import { brand } from '../../theme';

const DURATIONS = [[30, '30 minutes'], [60, '1 hour'], [90, '1 hour 30 minutes'], [120, '2 hours']];
const FOCUS = ['Personal training', 'Strength', 'Weight loss', 'Cardio', 'Mobility and flexibility', 'Form check', 'Program consultation'];
const toMin = (t) => { const [h, m] = String(t || '00:00').split(':').map(Number); return h * 60 + m; };
const toHhmm = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

function slotOptions(openTime, closeTime, duration, busy, date) {
  const open = toMin(openTime);
  const close = toMin(closeTime);
  if (!(close > open)) return [];
  const now = dayjs();
  const out = [];
  for (let t = open; t + duration <= close; t += 30) {
    const start = dayjs(`${date}T${toHhmm(t)}`);
    if (!start.isAfter(now)) continue;
    const taken = busy.some((b) => t < toMin(b.endTime) && toMin(b.startTime) < t + duration);
    out.push({ value: toHhmm(t), taken });
  }
  return out;
}

function BookingCard({ b, onCancel }) {
  const canCancel = ['Pending', 'Approved'].includes(b.status) && dayjs(`${dayjs(b.sessionDate).format('YYYY-MM-DD')}T${b.startTime}`).isAfter(dayjs());
  return (
    <Box sx={{ p: 2, border: `1px solid ${brand.line}`, borderRadius: 2.5 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <UserAvatar name={b.coachName} src={b.coach?.avatarUrl} size={40} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={800} noWrap>{b.coachName || 'Coach'}</Typography>
          <Typography variant="body2" color="text.secondary">{fday(b.sessionDate)} · {hhmm12(b.startTime)} – {hhmm12(b.endTime)}</Typography>
        </Box>
        <StatusChip label={b.status} />
      </Stack>
      {(b.focus || b.notes) && <Typography variant="body2" sx={{ mt: 1 }}>{[b.focus, b.notes].filter(Boolean).join(' · ')}</Typography>}
      {b.responseNote && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>Coach note: {b.responseNote}</Typography>}
      {b.cancelReason && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>Cancelled: {b.cancelReason}</Typography>}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary">{b.bookingNo}</Typography>
        {canCancel && <Button size="small" color="error" onClick={() => onCancel(b)}>Cancel booking</Button>}
      </Stack>
    </Box>
  );
}

export default function MemberBookings() {
  usePageTitle('Coach Bookings', 'Reserve a session with a coach and track your bookings.');
  const toast = useToast();
  const { account } = useAuth();
  const [params] = useSearchParams();
  const coaches = useFetch('/coaches', { initial: [] });
  const mine = useFetch('/bookings/mine', { initial: [] });
  const [f, setF] = useState({ coachId: params.get('coach') || '', date: isoDay(dayjs().add(1, 'day')), duration: 60, startTime: '', focus: FOCUS[0], notes: '' });
  const [day, setDay] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [cancel, setCancel] = useState(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (f.coachId || !coaches.data?.length) return;
    const assigned = account?.assignedCoach && coaches.data.find((c) => String(c._id) === String(account.assignedCoach));
    setF((x) => ({ ...x, coachId: (assigned || coaches.data[0])._id }));
  }, [coaches.data, account]);

  const loadDay = async () => {
    if (!f.coachId || !f.date) return setDay(null);
    try {
      const { data } = await api.get(`/bookings/coach-day/${f.coachId}`, { params: { date: f.date } });
      setDay(data);
    } catch (err) {
      setDay(null);
      setError(errMsg(err));
    }
  };
  useEffect(() => { loadDay(); }, [f.coachId, f.date]);
  useSocketEvent('booking:update', () => { mine.reload(); loadDay(); });

  const slots = useMemo(() => (day ? slotOptions(day.openTime, day.closeTime, Number(f.duration), day.busy, f.date) : []), [day, f.duration, f.date]);
  useEffect(() => {
    if (f.startTime && !slots.some((s) => s.value === f.startTime && !s.taken)) setF((x) => ({ ...x, startTime: '' }));
  }, [slots]);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.startTime) return setError('Choose a start time.');
    setBusy(true);
    setError('');
    try {
      const endTime = toHhmm(toMin(f.startTime) + Number(f.duration));
      await api.post('/bookings', { coachId: f.coachId, date: f.date, startTime: f.startTime, endTime, focus: f.focus, notes: f.notes || undefined });
      toast('Booking requested. You will be notified when the coach responds.');
      setF((x) => ({ ...x, startTime: '', notes: '' }));
      mine.reload();
      loadDay();
      setTab(0);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async () => {
    try {
      await api.patch(`/bookings/${cancel._id}/cancel`, { reason: reason || undefined });
      toast('Booking cancelled');
      setCancel(null);
      setReason('');
      mine.reload();
      loadDay();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const list = mine.data || [];
  const upcoming = list.filter((b) => ['Pending', 'Approved'].includes(b.status)).sort((a, b) => `${a.sessionDate}${a.startTime}`.localeCompare(`${b.sessionDate}${b.startTime}`));
  const history = list.filter((b) => !['Pending', 'Approved'].includes(b.status));
  const coach = (coaches.data || []).find((c) => String(c._id) === String(f.coachId));

  return (
    <Grid cols={{ xs: 1, md: '1fr 1.2fr' }}>
      <Section title="Book a session">
        <Stack component="form" spacing={2} onSubmit={submit}>
          {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
          <TextField select label="Coach" value={f.coachId} onChange={(e) => setF({ ...f, coachId: e.target.value })} required>
            {(coaches.data || []).map((c) => <MenuItem key={c._id} value={c._id}>{c.name}{c.specializations?.length ? ` · ${c.specializations.slice(0, 2).join(', ')}` : ''}</MenuItem>)}
          </TextField>
          {coach && <Stack direction="row" spacing={1} alignItems="center"><Typography variant="caption" color="text.secondary">Right now:</Typography><StatusChip label={coach.availabilityStatus || 'Unavailable'} /></Stack>}
          <Grid cols={{ xs: 1, sm: 2 }}>
            <TextField label="Date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} InputLabelProps={{ shrink: true }} inputProps={{ min: isoDay(), max: isoDay(dayjs().add(60, 'day')) }} required />
            <TextField select label="Length" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })}>
              {DURATIONS.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
            </TextField>
          </Grid>
          <TextField select label="Start time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} required helperText={day ? `Gym hours ${hhmm12(day.openTime)} – ${hhmm12(day.closeTime)}` : ' '}>
            {!slots.length && <MenuItem disabled value="">No times left on this day</MenuItem>}
            {slots.map((s) => <MenuItem key={s.value} value={s.value} disabled={s.taken}>{hhmm12(s.value)}{s.taken ? ' · taken' : ''}</MenuItem>)}
          </TextField>
          <TextField select label="Focus" value={f.focus} onChange={(e) => setF({ ...f, focus: e.target.value })}>
            {FOCUS.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
          </TextField>
          <TextField label="Notes for the coach (optional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} multiline minRows={2} inputProps={{ maxLength: 500 }} />
          <Button type="submit" variant="contained" size="large" disabled={busy || !f.coachId}>{busy ? 'Sending…' : 'Request booking'}</Button>
          {day?.busy?.length > 0 && (
            <Box>
              <Typography variant="caption" fontWeight={800} display="block" sx={{ mb: 0.5 }}>Coach is busy on {fday(f.date)}:</Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {day.busy.map((b, i) => <StatusChip key={i} label={`${hhmm12(b.startTime)}–${hhmm12(b.endTime)} · ${b.kind}`} color="grey" />)}
              </Stack>
            </Box>
          )}
        </Stack>
      </Section>
      <Section title="My bookings" contentSx={{ pt: 0 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}><Tab label={`Upcoming (${upcoming.length})`} /><Tab label={`History (${history.length})`} /></Tabs>
        <DataState {...mine} onRetry={mine.reload}>
          <Stack spacing={1.5}>
            {(tab === 0 ? upcoming : history).map((b) => <BookingCard key={b._id} b={b} onCancel={setCancel} />)}
            {!(tab === 0 ? upcoming : history).length && <Empty>{tab === 0 ? 'No upcoming bookings. Request one on the left.' : 'No past bookings yet.'}</Empty>}
          </Stack>
        </DataState>
      </Section>
      <Dialog open={!!cancel} onClose={() => setCancel(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Cancel this booking?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>{cancel && `${cancel.coachName} · ${fday(cancel.sessionDate)} · ${hhmm12(cancel.startTime)}`}</Typography>
          <TextField fullWidth label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancel(null)}>Keep it</Button>
          <Button color="error" variant="contained" onClick={doCancel}>Cancel booking</Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
