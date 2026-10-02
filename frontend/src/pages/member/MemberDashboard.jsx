import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import EmojiEventsOutlined from '@mui/icons-material/EmojiEventsOutlined';
import dayjs from 'dayjs';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../context/SocketContext';
import { usePageTitle } from '../../components/AppShell';
import { Banner, Grid, Section, StatusChip, Empty, UserAvatar } from '../../components/ui';
import { BarChart, LineChart } from '../../components/Charts';
import { fdate, ftime, fdm, hourLabel, hhmm12 } from '../../utils/format';
import { brand } from '../../theme';

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};
const STATUS_COLOR = { Active: brand.green, 'Near Expiry': brand.yellowInk, 'Grace Period': brand.orange, Expired: brand.red, Pending: brand.ink2 };

function dayLabel(d) {
  if (dayjs(d).isSame(dayjs(), 'day')) return 'Today';
  if (dayjs(d).isSame(dayjs().add(1, 'day'), 'day')) return 'Tomorrow';
  return fdm(d);
}

export default function MemberDashboard() {
  const { account, refresh } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  usePageTitle(`${greet()}, ${account?.firstName || ''}!`, "Let's continue your fitness journey today.");
  const me = useFetch('/members/me');
  const visits = useFetch('/attendance/me');
  const busy = useFetch('/attendance/busy');
  const sessions = useFetch('/programs/sessions', { params: { enrolled: 'true', days: 7 }, initial: [] });
  const badges = useFetch('/engagement/badges/me');
  const [btnBusy, setBtnBusy] = useState(false);

  useSocketEvent('busy:update', busy.reload);
  useSocketEvent('attendance:self', () => {
    visits.reload();
    me.reload();
  });
  useSocketEvent('coach:availability', (p) => {
    if (p?.coachId && me.data?.coach && String(p.coachId) === String(me.data.coach._id)) {
      me.setData((d) => ({ ...d, coach: { ...d.coach, availabilityStatus: p.availabilityStatus } }));
    }
  });

  const toggle = async () => {
    setBtnBusy(true);
    try {
      const { data } = await api.post('/attendance/me/toggle');
      toast(`${data.title} ${data.message}`, data.ok ? 'success' : 'error');
      visits.reload();
      me.reload();
      badges.reload();
      if (data.ok) refresh();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBtnBusy(false);
    }
  };

  const m = me.data?.member || account;
  const coach = me.data?.coach;
  const open = visits.data?.open;
  const list = visits.data?.visits || [];

  const last30 = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => dayjs().subtract(29 - i, 'day'));
    const counts = days.map((d) => list.filter((v) => dayjs(v.timeIn).isSame(d, 'day')).length);
    return { labels: days.map((d) => d.format('MMM D')), counts, total: counts.reduce((a, b) => a + b, 0) };
  }, [list]);

  const hours = Array.from({ length: 17 }, (_, i) => i + 6);
  const nowH = new Date().getHours();
  const b = busy.data;
  const busyNow = b?.today?.[nowH] || 0;
  const avgNow = b?.average?.[nowH] || 0;
  const liveText = !b ? 'Loading…' : busyNow === 0 && avgNow === 0 ? 'Quiet right now' : busyNow < avgNow * 0.85 ? 'Less busy than usual' : busyNow > avgNow * 1.15 ? 'Busier than usual' : 'As busy as usual';
  const upcoming = (sessions.data || []).filter((s) => s.status !== 'Cancelled' && new Date(s.end) > new Date()).slice(0, 4);
  const earned = (badges.data?.badges || []).filter((x) => x.earned).sort((x, y) => new Date(y.earnedAt) - new Date(x.earnedAt));
  const canCheckIn = ['Active', 'Near Expiry', 'Grace Period'].includes(m?.status);

  return (
    <Stack spacing={2}>
      <Banner
        line1="Discipline today."
        accent="Strength"
        rest="tomorrow."
        sub={open ? `You checked in at ${ftime(open.timeIn)}. Have a great session!` : canCheckIn ? 'Tap Check In when you arrive at the gym.' : 'Renew your membership to check in.'}
        actions={
          <>
            <Button size="large" variant="contained" color={open ? 'secondary' : 'primary'} onClick={toggle} disabled={btnBusy || (!open && !canCheckIn)}>
              {open ? 'Check Out' : 'Check In'}
            </Button>
            <Button size="large" variant="outlined" onClick={() => navigate('/member/programs')}>Programs</Button>
          </>
        }
      />

      <Grid cols={{ xs: 1, sm: 2, lg: 3 }}>
        <Section>
          <Typography variant="overline">Membership</Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 800, color: STATUS_COLOR[m?.status] || brand.ink }}>{m?.current?.planName || 'No active plan'}</Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {m?.current?.endDate ? `Valid until ${fdate(m.current.endDate)}` : 'Pay to activate your plan'}
            {m?.daysLeft != null && m.daysLeft >= 0 ? ` · ${m.daysLeft} day${m.daysLeft === 1 ? '' : 's'} left` : ''}
          </Typography>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
            {m?.status && <StatusChip label={m.status} />}
            <Button size="small" onClick={() => navigate('/member/payments')}>{['Expired', 'Pending', 'Grace Period', 'Near Expiry'].includes(m?.status) ? 'Renew now' : 'View details'}</Button>
          </Stack>
        </Section>
        <Section>
          <Typography variant="overline">Your coach</Typography>
          {coach ? (
            <>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <UserAvatar name={coach.name} src={coach.avatarUrl} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 800 }} noWrap>{coach.name}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">{(coach.specializations || []).slice(0, 2).join(' & ') || 'Coach'}</Typography>
                </Box>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                <StatusChip label={coach.availabilityStatus || 'Unavailable'} />
                <Button size="small" onClick={() => navigate('/member/messages')}>Message</Button>
              </Stack>
            </>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">No coach yet.</Typography>
              <Button size="small" sx={{ mt: 1 }} onClick={() => navigate('/member/coaches')}>Find a coach</Button>
            </>
          )}
        </Section>
        <Section>
          <Typography variant="overline">Next session</Typography>
          {upcoming[0] ? (
            <>
              <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{upcoming[0].programName}</Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {dayLabel(upcoming[0].scheduleDate)} {hhmm12(upcoming[0].startTime)}{upcoming[0].coachName ? ` · Coach ${upcoming[0].coachName.split(' ')[0]}` : ''}
              </Typography>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">No sessions in the next 7 days.</Typography>
          )}
          <Button size="small" sx={{ mt: 1 }} onClick={() => navigate('/member/programs')}>View schedule</Button>
        </Section>
      </Grid>

      <Card sx={{ bgcolor: brand.panel, color: '#ddd', border: 0 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" flexWrap="wrap" useFlexGap spacing={1}>
            <Typography sx={{ fontSize: 18 }}>
              <Box component="span" sx={{ color: '#F08880', fontWeight: 700 }}>Live:</Box> {liveText}
            </Typography>
            <Typography variant="caption" sx={{ color: '#aaa' }}>
              {b ? `${b.inGymNow} in the gym now · open ${hhmm12(b.openTime)}–${hhmm12(b.closeTime)}` : ''}
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: '#999' }}>{b ? `Usually ${avgNow} check-ins at this hour (4-week average)` : ''}</Typography>
          {b && <BarChart dark height={170} labels={hours.map(hourLabel)} data={hours.map((h) => b.average[h])} color="#8C8C8C" highlight={hours.indexOf(nowH)} highlightColor="#F08880" label="Avg check-ins" />}
        </CardContent>
      </Card>

      <Grid cols={{ xs: 1, md: '2fr 1fr' }}>
        <Section title="Upcoming sessions" action={<Button size="small" onClick={() => navigate('/member/programs')}>Full schedule</Button>}>
          <Stack spacing={1.5}>
            {upcoming.length ? (
              upcoming.map((s) => (
                <Stack key={s._id} direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width: 84, flex: 'none' }}>
                    <Typography variant="body2" fontWeight={700} sx={{ color: dayjs(s.scheduleDate).isSame(dayjs(), 'day') ? brand.yellow : 'inherit' }}>{dayLabel(s.scheduleDate)}</Typography>
                    <Typography variant="caption" color="text.secondary">{hhmm12(s.startTime)}</Typography>
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700} noWrap>{s.programName}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.coachName ? `Coach ${s.coachName}` : s.category} · {s.durationMins} min</Typography>
                  </Box>
                  <StatusChip label={s.state} />
                </Stack>
              ))
            ) : (
              <Empty>Enroll in a program to see your sessions here.</Empty>
            )}
          </Stack>
        </Section>
        <Section title="Recent badges" action={<Button size="small" onClick={() => navigate('/member/progress')}>All badges</Button>}>
          {earned.length ? (
            <Stack spacing={1.5}>
              {earned.slice(0, 4).map((x) => (
                <Stack key={x.key} direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: brand.yellow, color: '#fff', display: 'grid', placeItems: 'center', flex: 'none' }}>
                    <EmojiEventsOutlined fontSize="small" />
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={700}>{x.name}</Typography>
                    <Typography variant="caption" color="text.secondary">Earned {fdate(x.earnedAt)}</Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          ) : (
            <Empty>Check in to earn your first badge.</Empty>
          )}
        </Section>
      </Grid>

      <Grid cols={{ xs: 1, md: '2fr 1fr' }}>
        <Section title="Visits in the last 30 days" action={<StatusChip label={`${last30.total} visits`} />}>
          <LineChart height={180} labels={last30.labels} series={[{ label: 'Visits', data: last30.counts, color: brand.orange, fill: true }]} />
        </Section>
        <Section title="Recent visits">
          {list.length ? (
            <Stack spacing={1}>
              {list.slice(0, 5).map((v) => (
                <Stack key={v._id} direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2" fontWeight={700}>{fdate(v.timeIn)}</Typography>
                    <Typography variant="caption" color="text.secondary">{ftime(v.timeIn)} – {v.timeOut ? ftime(v.timeOut) : 'now'} · {v.method}</Typography>
                  </Box>
                  <StatusChip label={v.status} />
                </Stack>
              ))}
            </Stack>
          ) : (
            <Empty>No visits yet.</Empty>
          )}
        </Section>
      </Grid>
    </Stack>
  );
}
