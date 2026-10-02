import { useNavigate } from 'react-router-dom';
import { Box, Button, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../context/SocketContext';
import { usePageTitle } from '../../components/AppShell';
import { linkFor } from '../../components/NotificationsMenu';
import { Banner, DataState, Grid, Section, StatCard, StatusChip, Progress, Empty } from '../../components/ui';
import { LineChart, Ring } from '../../components/Charts';
import { fdate, fdm, ago, hhmm12 } from '../../utils/format';
import { brand } from '../../theme';

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function CoachDashboard() {
  const { account, role } = useAuth();
  const navigate = useNavigate();
  usePageTitle(`${greet()}, Coach ${account?.firstName || ''}!`, "Here's your overview for today.");
  const d = useFetch('/reports/coach');
  const notes = useFetch('/notifications', { params: { limit: 5 } });
  useSocketEvent('notification', notes.reload);
  useSocketEvent('busy:update', d.reload);
  const x = d.data;

  return (
    <DataState {...d} onRetry={d.reload}>
      {x && (
        <Stack spacing={2}>
          <Banner line1="Inspire today." accent="Transform" rest="tomorrow." sub={`You have ${x.sessionsToday.length} session${x.sessionsToday.length === 1 ? '' : 's'} today.`}
            actions={<><Button size="large" variant="contained" onClick={() => navigate('/coach/schedule')}>View My Schedule</Button><Button size="large" variant="outlined" onClick={() => navigate('/coach/clients')}>Manage Clients</Button></>} />
          <Grid cols={{ xs: 1, sm: 2, lg: 4 }}>
            <StatCard label="Today's sessions" value={x.sessionsToday.length} sub={`${x.sessionsToday.filter((s) => s.state === 'Completed').length} completed · ${x.sessionsToday.filter((s) => ['Upcoming', 'In Progress'].includes(s.state)).length} remaining`} />
            <StatCard label="My clients" value={x.clients} sub={`${x.activeClients} active · ${x.clients - x.activeClients} inactive`} />
            <StatCard label="Active programs" value={x.programs.length} sub={x.programs.map((p) => p.programName).join(', ') || 'None yet'} />
            <Section>
              <Typography variant="body2" fontWeight={600}>My availability</Typography>
              <Box sx={{ my: 1 }}><StatusChip label={account?.availabilityStatus || x.availabilityStatus} /></Box>
              <Typography variant="caption" color="text.secondary">Members see this live. Change it at the top right.</Typography>
            </Section>
          </Grid>
          <Grid cols={{ xs: 1, md: '2fr 1fr' }}>
            <Section title="Client activity overview" action={<StatusChip label="Last 30 days" />}>
              <Grid cols={{ xs: 1, sm: '1fr 130px' }} sx={{ alignItems: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Client check-ins</Typography>
                  <Typography sx={{ fontSize: 24, fontWeight: 800 }}>{x.checkins.reduce((a, c) => a + c.value, 0)}</Typography>
                  <LineChart height={160} labels={x.checkins.map((c) => fdm(c.date))} series={[{ label: 'Check-ins', data: x.checkins.map((c) => c.value), color: brand.orange, fill: true }]} />
                </Box>
                <Ring value={x.clients ? Math.round((x.activeClients / x.clients) * 100) : 0} label="Active clients" />
              </Grid>
            </Section>
            <Section title="Today's schedule" action={<Button size="small" onClick={() => navigate('/coach/schedule')}>Full schedule</Button>}>
              <Stack spacing={1.5}>
                {x.sessionsToday.length ? x.sessionsToday.map((s) => (
                  <Stack key={s._id} direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="body2" fontWeight={700} sx={{ width: 72 }}>{hhmm12(s.startTime)}</Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} noWrap>{s.programName}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.enrolled}/{s.capacity} enrolled · until {hhmm12(s.endTime)}</Typography>
                    </Box>
                    <StatusChip label={s.state} />
                  </Stack>
                )) : <Empty>No sessions today.</Empty>}
              </Stack>
            </Section>
          </Grid>
          <Grid cols={{ xs: 1, md: '2fr 1fr' }}>
            <Section title="Recent client activity" action={<Button size="small" onClick={() => navigate('/coach/clients')}>All clients</Button>}>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Client</TableCell><TableCell>Goal</TableCell><TableCell>Last visit</TableCell><TableCell>Visits (30d)</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                  <TableBody>
                    {x.recentClients.map((c) => (
                      <TableRow key={c._id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/coach/progress?member=${c._id}`)}>
                        <TableCell><Typography variant="body2" fontWeight={700}>{c.name}</Typography><Typography variant="caption" color="text.secondary">{c.memberCode}</Typography></TableCell>
                        <TableCell>{c.fitnessGoal || '—'}</TableCell>
                        <TableCell>{fdate(c.lastVisitAt)}</TableCell>
                        <TableCell><Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 110 }}><Progress value={(c.visits30 / 12) * 100} color={brand.green} /><Typography variant="caption">{c.visits30}</Typography></Stack></TableCell>
                        <TableCell><StatusChip label={c.active ? 'Active' : 'Inactive'} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!x.recentClients.length && <Empty>No clients yet.</Empty>}
              </Box>
            </Section>
            <Section title="Notifications" action={<Button size="small" onClick={() => navigate('/coach/notifications')}>View all</Button>}>
              <Stack spacing={1.5}>
                {notes.data?.items?.map((n) => (
                  <Box key={n._id} onClick={() => { const to = linkFor(role, n.link); if (to) navigate(to); }} sx={{ cursor: n.link ? 'pointer' : 'default' }}>
                    <Typography variant="body2" fontWeight={n.status === 'Unread' ? 800 : 600}>{n.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{n.message ? `${n.message} · ` : ''}{ago(n.dateSent)}</Typography>
                  </Box>
                ))}
                {!notes.data?.items?.length && <Empty>All caught up.</Empty>}
              </Stack>
            </Section>
          </Grid>
        </Stack>
      )}
    </DataState>
  );
}
