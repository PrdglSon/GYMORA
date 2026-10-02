import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Stack, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material';
import dayjs from 'dayjs';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../context/SocketContext';
import { usePageTitle, useBase } from '../../components/AppShell';
import { DataState, Grid, Section, StatCard, StatusChip, Progress, UserAvatar, Empty } from '../../components/ui';
import { LineChart, DonutChart } from '../../components/Charts';
import { peso, peso0, fdm, ftime, hhmm12 } from '../../utils/format';
import { brand } from '../../theme';

const TABS = [['revenue', 'Revenue'], ['newMembers', 'New Members'], ['checkins', 'Check-ins']];

function Alert({ bg, color, title, sub, onClick }) {
  return (
    <Box onClick={onClick} sx={{ cursor: 'pointer', bgcolor: bg, borderRadius: 2, p: 1.2 }}>
      <Typography variant="body2" fontWeight={700} sx={{ color: color || brand.ink }}>{title}</Typography>
      <Typography variant="caption">{sub}</Typography>
    </Box>
  );
}

export default function AdminDashboard() {
  const { account, role } = useAuth();
  const base = useBase();
  const navigate = useNavigate();
  usePageTitle(`Welcome back, ${account?.firstName || ''}!`, role === 'receptionist' ? "Here's today's front-desk overview." : "Here's the overview of all gym operations.");
  const d = useFetch('/reports/dashboard');
  const [tab, setTab] = useState('revenue');
  useSocketEvent('attendance:update', d.reload);
  useSocketEvent('payments:update', d.reload);
  const x = d.data;
  const go = (p) => navigate(`${base}/${p}`);

  return (
    <DataState {...d} onRetry={d.reload}>
      {x && (
        <Stack spacing={2}>
          <Grid cols={{ xs: 1, sm: 2, lg: 5 }}>
            <StatCard label="Total members" value={x.cards.totalMembers} sub={`+${x.cards.newMembers30} in the last 30 days`} subColor={brand.green} />
            <StatCard label="Members checked in today" value={x.cards.membersToday} delta={[x.cards.membersToday, x.cards.membersYesterday]} />
            <StatCard label="Walk-in guests today" value={x.cards.walkinsToday} delta={[x.cards.walkinsToday, x.cards.walkinsYesterday]} />
            <StatCard label="Today's sales" value={peso0(x.cards.salesToday)} delta={[x.cards.salesToday, x.cards.salesYesterday]} />
            <StatCard label="Outstanding payments" value={peso0(x.cards.unpaidTotal)} sub={`${x.cards.unpaidCount} unpaid invoices`} subColor={brand.orange} />
          </Grid>
          <Grid cols={{ xs: 1, md: '2fr 1fr' }}>
            <Section title="Operational overview" action={<StatusChip label="Last 30 days" />}>
              <Grid cols={{ xs: 1, sm: '150px 1fr' }}>
                <Stack spacing={0.5}>
                  {TABS.map(([k, label]) => <Button key={k} size="small" onClick={() => setTab(k)} sx={{ justifyContent: 'flex-start', color: brand.ink, bgcolor: tab === k ? brand.yellowSoft : 'transparent' }}>{label}</Button>)}
                </Stack>
                <Box>
                  <Typography variant="caption" color="text.secondary">{TABS.find((t) => t[0] === tab)[1]}</Typography>
                  <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{tab === 'revenue' ? peso0(x.series.revenue.reduce((a, v) => a + v.value, 0)) : x.series[tab].reduce((a, v) => a + v.value, 0)}</Typography>
                  <LineChart height={200} money={tab === 'revenue'} labels={x.series[tab].map((v) => fdm(v.date))} series={[{ label: TABS.find((t) => t[0] === tab)[1], data: x.series[tab].map((v) => v.value), color: brand.orange, fill: true }]} />
                </Box>
              </Grid>
            </Section>
            <Section title="Today's attendance summary" action={<Button size="small" onClick={() => go('attendance')}>Manage →</Button>}>
              <Stack spacing={1.5}>
                {[[x.cards.membersToday, 'Members checked in', brand.green], [x.cards.walkinsToday, 'Walk-in guests', brand.yellow], [x.cards.checkinsToday, 'Total check-ins', brand.blue], [x.cards.inGymNow, 'In the gym now', brand.orange]].map(([v, l, c]) => (
                  <Stack key={l} direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: `${c}2E` }} />
                    <Box><Typography sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{v}</Typography><Typography variant="caption" color="text.secondary">{l}</Typography></Box>
                  </Stack>
                ))}
              </Stack>
            </Section>
          </Grid>
          <Grid cols={{ xs: 1, md: 3 }}>
            <Section title="Membership status" action={<Button size="small" onClick={() => go('members')}>Members →</Button>}>
              <DonutChart center={x.cards.totalMembers} sub="Total members" segments={[{ label: 'Active', value: x.membershipStatus.active, color: brand.green }, { label: 'Near expiry', value: x.membershipStatus.nearExpiry, color: brand.yellow }, { label: 'Expired', value: x.membershipStatus.expired, color: brand.orange }, { label: 'Not yet paid', value: x.membershipStatus.pending, color: '#BDBDBD' }]} />
            </Section>
            <Section title="Today's classes">
              <Stack spacing={1}>
                {x.todaysClasses.map((c) => (
                  <Stack key={c._id} direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ width: 64 }}>{hhmm12(c.startTime)}</Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>{c.programName}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ width: 60 }}>{(c.coachName || '').split(' ')[0]}</Typography>
                    <Typography variant="caption">{c.enrolled}/{c.capacity}</Typography>
                    <StatusChip label={c.state} />
                  </Stack>
                ))}
                {!x.todaysClasses.length && <Empty>No classes today.</Empty>}
              </Stack>
            </Section>
            <Section title="System alerts">
              <Stack spacing={1}>
                {x.alerts.lowStock.slice(0, 2).map((p) => <Alert key={p._id} bg={brand.redSoft} color={brand.red} title={`${p.stockQuantity <= 0 ? 'Out of stock' : 'Low stock'}: ${p.productName}`} sub={`${p.stockQuantity} left in inventory`} onClick={() => go('inventory')} />)}
                {x.alerts.openIncidents > 0 && <Alert bg={brand.orangeSoft} title={`${x.alerts.openIncidents} open incident reports`} sub={x.alerts.latestIncident} onClick={() => go('incidents')} />}
                {x.alerts.openInquiries > 0 && <Alert bg={brand.yellowSoft} title={`${x.alerts.openInquiries} open support requests`} sub="Customer support inbox" onClick={() => go('support')} />}
                {x.alerts.equipment.slice(0, 2).map((e) => <Alert key={e._id} bg={brand.orangeSoft} title={`${e.equipmentName}${e.code ? ` ${e.code}` : ''}`} sub={e.status !== 'Operational' ? e.status : `Service due ${fdm(e.nextServiceAt)}`} onClick={() => go('equipment')} />)}
                {x.alerts.nearExpiry > 0 && <Alert bg={brand.blueSoft} title="Expiring memberships" sub={`${x.alerts.nearExpiry} memberships end soon`} onClick={() => go('members?status=Near%20Expiry')} />}
                {x.alerts.studentPending.length > 0 && <Alert bg={brand.purpleSoft} title="Student IDs to verify" sub={x.alerts.studentPending.map((s) => s.name).join(', ')} onClick={() => go('members?status=Student%20pending')} />}
                {!x.alerts.lowStock.length && !x.alerts.openIncidents && !x.alerts.openInquiries && !x.alerts.equipment.length && !x.alerts.nearExpiry && !x.alerts.studentPending.length && <Empty>All clear.</Empty>}
              </Stack>
            </Section>
          </Grid>
          <Grid cols={{ xs: 1, md: 2 }}>
            <Section title="Recent transactions" action={<Button size="small" onClick={() => go('billing')}>View all →</Button>}>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small"><TableBody>
                  {x.recentPayments.map((p) => (
                    <TableRow key={p._id}>
                      <TableCell><Stack direction="row" spacing={1} alignItems="center"><UserAvatar name={p.payerName} size={28} /><b>{p.payerName}</b></Stack></TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{p.description}</TableCell>
                      <TableCell align="right"><b>{peso(p.amount)}</b></TableCell>
                      <TableCell><StatusChip label={p.status} /></TableCell>
                      <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{dayjs(p.createdAt).isSame(dayjs(), 'day') ? ftime(p.createdAt) : fdm(p.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody></Table>
                {!x.recentPayments.length && <Empty>No payments yet.</Empty>}
              </Box>
            </Section>
            <Section title="Top programs (enrolled)">
              <Stack spacing={1.5}>
                {x.topPrograms.map((p, i) => (
                  <Stack key={p.programName} direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="body2" sx={{ width: 14 }}>{i + 1}</Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ width: 150 }} noWrap>{p.programName}</Typography>
                    <Progress value={p.capacity ? (p.enrolled / p.capacity) * 100 : 0} />
                    <Typography variant="caption" color="text.secondary" sx={{ width: 80, textAlign: 'right' }}>{p.enrolled}/{p.capacity}</Typography>
                  </Stack>
                ))}
                {!x.topPrograms.length && <Empty>No active programs.</Empty>}
              </Stack>
            </Section>
          </Grid>
        </Stack>
      )}
    </DataState>
  );
}
