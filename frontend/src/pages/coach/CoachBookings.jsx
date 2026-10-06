import { useState } from 'react';
import { Box, Stack, Tab, Tabs, Typography } from '@mui/material';
import dayjs from 'dayjs';
import useFetch from '../../hooks/useFetch';
import { useSocketEvent } from '../../context/SocketContext';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Empty, Grid, Section, StatCard, StatusChip, UserAvatar } from '../../components/ui';
import BookingActions, { sessionStart } from '../../components/BookingActions';
import { fday, hhmm12 } from '../../utils/format';
import { brand } from '../../theme';

function Row({ b, onDone }) {
  return (
    <Box sx={{ p: 2, border: `1px solid ${brand.line}`, borderRadius: 2.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
          <UserAvatar name={b.memberName} src={b.member?.avatarUrl} size={40} />
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={800} noWrap>{b.memberName} <Typography component="span" variant="caption" color="text.secondary">{b.memberCode}</Typography></Typography>
            <Typography variant="body2" color="text.secondary">{fday(b.sessionDate)} · {hhmm12(b.startTime)} – {hhmm12(b.endTime)}</Typography>
            {(b.focus || b.notes) && <Typography variant="body2">{[b.focus, b.notes].filter(Boolean).join(' · ')}</Typography>}
            {b.responseNote && <Typography variant="caption" color="text.secondary">Note: {b.responseNote}</Typography>}
          </Box>
        </Stack>
        <Stack alignItems={{ sm: 'flex-end' }} spacing={1}>
          <StatusChip label={b.status} />
          <BookingActions b={b} onDone={onDone} />
        </Stack>
      </Stack>
    </Box>
  );
}

export default function CoachBookings() {
  usePageTitle('Bookings', 'Approve session requests and manage your booked sessions.');
  const d = useFetch('/bookings/coach', { initial: [] });
  const [tab, setTab] = useState(0);
  useSocketEvent('booking:update', () => d.reload());
  const list = d.data || [];
  const now = dayjs();
  const requests = list.filter((b) => b.status === 'Pending');
  const upcoming = list.filter((b) => b.status === 'Approved' && sessionStart(b).isAfter(now));
  const toMark = list.filter((b) => b.status === 'Approved' && !sessionStart(b).isAfter(now));
  const history = list.filter((b) => !['Pending', 'Approved'].includes(b.status)).reverse();
  const groups = [requests, upcoming, toMark, history];
  const empty = ['No booking requests right now.', 'No upcoming approved sessions.', 'Nothing to mark. Sessions appear here after they start.', 'No past bookings yet.'];
  const today = list.filter((b) => b.status === 'Approved' && dayjs(b.sessionDate).isSame(now, 'day')).length;
  const done = list.filter((b) => b.status === 'Completed').length;

  return (
    <Stack spacing={2}>
      <Grid cols={{ xs: 2, md: 4 }}>
        <StatCard label="New requests" value={requests.length} />
        <StatCard label="Sessions today" value={today} />
        <StatCard label="Upcoming" value={upcoming.length} />
        <StatCard label="Completed" value={done} />
      </Grid>
      <Section>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ mb: 2 }}>
          <Tab label={`Requests (${requests.length})`} />
          <Tab label={`Upcoming (${upcoming.length})`} />
          <Tab label={`To mark (${toMark.length})`} />
          <Tab label="History" />
        </Tabs>
        <DataState {...d} onRetry={d.reload}>
          <Stack spacing={1.5}>
            {groups[tab].map((b) => <Row key={b._id} b={b} onDone={d.reload} />)}
            {!groups[tab].length && <Empty>{empty[tab]}</Empty>}
          </Stack>
        </DataState>
      </Section>
    </Stack>
  );
}
