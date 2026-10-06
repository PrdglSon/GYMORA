import { useState } from 'react';
import { Box, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import useFetch from '../../hooks/useFetch';
import { useSocketEvent } from '../../context/SocketContext';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Empty, Grid, Progress, Section, StatCard, StatusChip } from '../../components/ui';
import BookingActions from '../../components/BookingActions';
import { fday, hhmm12, pct } from '../../utils/format';

const STATUSES = ['Pending', 'Approved', 'Completed', 'Declined', 'Cancelled', 'No-show', 'Expired'];

export default function Bookings() {
  usePageTitle('Coach Bookings', 'Booking requests, approvals, cancellations and coach utilization.');
  const [filter, setFilter] = useState({ status: '', coach: '', from: '', to: '' });
  const [days, setDays] = useState(30);
  const params = Object.fromEntries(Object.entries(filter).filter(([, v]) => v));
  const list = useFetch('/bookings', { params });
  const stats = useFetch('/bookings/stats', { params: { days } });
  const coaches = useFetch('/coaches', { initial: [] });
  useSocketEvent('booking:update', () => { list.reload(); stats.reload(); });
  const reload = () => { list.reload(); stats.reload(); };
  const s = stats.data;
  const st = s?.status || {};
  const finished = (st.Completed || 0) + (st['No-show'] || 0);
  const set = (k) => (e) => setFilter({ ...filter, [k]: e.target.value });

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="flex-end">
        <TextField select size="small" label="Report period" value={days} onChange={(e) => setDays(e.target.value)} sx={{ minWidth: 170 }}>
          {[7, 30, 90, 365].map((d) => <MenuItem key={d} value={d}>Last {d} days</MenuItem>)}
        </TextField>
      </Stack>
      <Grid cols={{ xs: 2, md: 5 }}>
        <StatCard label="Total bookings" value={s?.total ?? '—'} sub={`last ${days} days`} />
        <StatCard label="Awaiting approval" value={st.Pending ?? '—'} sub="pending requests" />
        <StatCard label="Upcoming sessions" value={s?.upcoming ?? '—'} sub="approved, from today" />
        <StatCard label="Completed" value={st.Completed ?? '—'} sub={`${pct(st.Completed || 0, finished)}% show-up rate`} />
        <StatCard label="Cancelled / declined" value={s ? (st.Cancelled || 0) + (st.Declined || 0) : '—'} sub={`${st.Expired || 0} expired`} />
      </Grid>
      <Section title="Coach utilization">
        <DataState {...stats} onRetry={stats.reload}>
          {s && (s.byCoach.length ? (
            <Stack spacing={1.5}>
              {s.byCoach.map((c) => (
                <Box key={c.coachId}>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2" fontWeight={700}>{c.coachName}</Typography><Typography variant="caption" color="text.secondary">{c.total} booking{c.total === 1 ? '' : 's'} · {c.completed} completed · {c.approved} upcoming</Typography></Stack>
                  <Progress value={pct(c.total, s.byCoach[0].total)} />
                </Box>
              ))}
            </Stack>
          ) : <Empty>No bookings in this period.</Empty>)}
        </DataState>
      </Section>
      <Section title="All bookings">
        <Grid cols={{ xs: 1, sm: 2, md: 4 }} sx={{ mb: 2 }}>
          <TextField select size="small" label="Status" value={filter.status} onChange={set('status')}>
            <MenuItem value="">All statuses</MenuItem>
            {STATUSES.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Coach" value={filter.coach} onChange={set('coach')}>
            <MenuItem value="">All coaches</MenuItem>
            {(coaches.data || []).map((c) => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}
          </TextField>
          <TextField size="small" type="date" label="From" value={filter.from} onChange={set('from')} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="date" label="To" value={filter.to} onChange={set('to')} InputLabelProps={{ shrink: true }} />
        </Grid>
        <DataState {...list} onRetry={list.reload}>
          {list.data && (list.data.items.length ? (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead><TableRow><TableCell>Booking</TableCell><TableCell>Member</TableCell><TableCell>Coach</TableCell><TableCell>Session</TableCell><TableCell>Focus</TableCell><TableCell>Status</TableCell><TableCell align="right" /></TableRow></TableHead>
                <TableBody>
                  {list.data.items.map((b) => (
                    <TableRow key={b._id} hover>
                      <TableCell>{b.bookingNo}</TableCell>
                      <TableCell><Typography variant="body2" fontWeight={700}>{b.memberName}</Typography><Typography variant="caption" color="text.secondary">{b.memberCode}</Typography></TableCell>
                      <TableCell>{b.coachName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{fday(b.sessionDate)}<br /><Typography variant="caption" color="text.secondary">{hhmm12(b.startTime)} – {hhmm12(b.endTime)}</Typography></TableCell>
                      <TableCell>{b.focus || '—'}</TableCell>
                      <TableCell><StatusChip label={b.status} /></TableCell>
                      <TableCell align="right"><BookingActions b={b} onDone={reload} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Typography variant="caption" color="text.secondary">{list.data.items.length} of {list.data.total} shown</Typography>
            </Box>
          ) : <Empty>No bookings match these filters.</Empty>)}
        </DataState>
      </Section>
    </Stack>
  );
}
