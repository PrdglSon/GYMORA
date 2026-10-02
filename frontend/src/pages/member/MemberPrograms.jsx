import { useState } from 'react';
import { Box, Button, Chip, Stack, Tab, Tabs, Typography } from '@mui/material';
import dayjs from 'dayjs';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../context/SocketContext';
import { usePageTitle } from '../../components/AppShell';
import { Banner, ConfirmDialog, DataState, Grid, Section, StatusChip, Progress, Empty } from '../../components/ui';
import { fday, hhmm12 } from '../../utils/format';
import { brand } from '../../theme';

export default function MemberPrograms() {
  usePageTitle('Programs', 'Find a program that fits your goals and enroll.');
  const toast = useToast();
  const { account } = useAuth();
  const programs = useFetch('/programs', { initial: [] });
  const week = useFetch('/programs/sessions', { params: { days: 7 }, initial: [] });
  const [cat, setCat] = useState('All');
  const [only, setOnly] = useState(false);
  const [leaving, setLeaving] = useState(null);
  const [busy, setBusy] = useState(null);

  useSocketEvent('coach:availability', (p) => {
    if (!p?.coachId) return;
    programs.setData((list) => (list || []).map((x) => (String(x.coach?._id) === String(p.coachId) ? { ...x, coachAvailability: p.availabilityStatus } : x)));
  });

  const all = programs.data || [];
  const cats = ['All', ...new Set(all.map((p) => p.category).filter(Boolean))];
  const list = all.filter((p) => cat === 'All' || p.category === cat);
  const inactive = ['Expired', 'Pending'].includes(account?.status);
  const enrolledIds = new Set(all.filter((p) => p.isEnrolled).map((p) => String(p._id)));
  const sessions = (week.data || []).filter((s) => !only || enrolledIds.has(String(s.programId)));

  const act = async (p, action) => {
    setBusy(p._id);
    try {
      await api.post(`/programs/${p._id}/${action}`);
      toast(action === 'enroll' ? `Enrolled in ${p.programName}` : `You left ${p.programName}`);
      programs.reload();
      week.reload();
      setLeaving(null);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const days = Array.from({ length: 7 }, (_, i) => dayjs().add(i, 'day'));

  return (
    <Stack spacing={2}>
      <Banner line1="Find the right" accent="program" rest="for your goals." sub="Explore programs designed to help you get stronger, fitter and healthier." />
      <Tabs value={cats.includes(cat) ? cat : 'All'} onChange={(_, v) => setCat(v)} variant="scrollable" scrollButtons="auto">
        {cats.map((c) => <Tab key={c} value={c} label={c} />)}
      </Tabs>
      <DataState {...programs} onRetry={programs.reload}>
        <Grid cols={{ xs: 1, sm: 2, lg: 3 }}>
          {list.map((p) => {
            const full = p.enrolled >= p.capacity;
            return (
              <Section key={p._id}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    <Chip size="small" label={p.category} sx={{ bgcolor: brand.yellowSoft, color: brand.yellowInk }} />
                    {p.level && <Chip size="small" label={p.level} />}
                  </Stack>
                  {p.isEnrolled && <StatusChip label="Enrolled" />}
                </Stack>
                <Typography variant="h6" sx={{ mt: 1 }}>{p.programName}</Typography>
                {p.description && <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>{p.description}</Typography>}
                <Stack spacing={0.5} sx={{ mt: 1 }}>
                  <Typography variant="body2" component="div">
                    <b>Coach:</b> {p.coachName || 'TBA'} {p.coachAvailability && <StatusChip label={p.coachAvailability} sx={{ ml: 0.5 }} />}
                  </Typography>
                  <Typography variant="body2"><b>Schedule:</b> {p.schedule || 'To be announced'}</Typography>
                  {p.durationWeeks ? <Typography variant="body2"><b>Duration:</b> {p.durationWeeks} weeks</Typography> : null}
                  <Typography variant="body2">
                    <b>Next session:</b> {p.nextSession ? `${fday(p.nextSession.scheduleDate)} ${hhmm12(p.nextSession.startTime)}` : 'None scheduled'}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ my: 1.5 }}>
                  <Progress value={(p.enrolled / (p.capacity || 1)) * 100} color={full ? brand.red : brand.yellow} />
                  <Typography variant="caption">{p.enrolled}/{p.capacity} slots</Typography>
                </Stack>
                {p.isEnrolled ? (
                  <Button fullWidth variant="outlined" disabled={busy === p._id} onClick={() => setLeaving(p)}>Leave program</Button>
                ) : (
                  <Button fullWidth variant="contained" disabled={full || inactive || busy === p._id} onClick={() => act(p, 'enroll')}>
                    {full ? 'Full' : inactive ? 'Renew membership to enroll' : 'Enroll'}
                  </Button>
                )}
              </Section>
            );
          })}
        </Grid>
        {!list.length && <Empty>No programs in this category.</Empty>}
      </DataState>

      <Section
        title="Sessions this week"
        action={
          <Stack direction="row" spacing={1}>
            <Chip label="All programs" onClick={() => setOnly(false)} color={!only ? 'primary' : 'default'} />
            <Chip label="My programs" onClick={() => setOnly(true)} color={only ? 'primary' : 'default'} />
          </Stack>
        }
      >
        <Box sx={{ overflowX: 'auto' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(130px, 1fr))', gap: 1, minWidth: 920 }}>
            {days.map((d) => {
              const items = sessions.filter((s) => dayjs(s.scheduleDate).isSame(d, 'day'));
              return (
                <Box key={d.format('YYYY-MM-DD')} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1, minHeight: 120, bgcolor: d.isSame(dayjs(), 'day') ? brand.yellowSoft : '#fff' }}>
                  <Typography variant="body2" fontWeight={800}>{d.format('ddd D')}</Typography>
                  {items.map((s) => (
                    <Box key={s._id} sx={{ mt: 1, pl: 1, borderLeft: `3px solid ${enrolledIds.has(String(s.programId)) ? brand.orange : brand.line}`, opacity: s.status === 'Cancelled' ? 0.5 : 1 }}>
                      <Typography variant="caption" fontWeight={700} display="block">{hhmm12(s.startTime)} – {hhmm12(s.endTime)}</Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ textDecoration: s.status === 'Cancelled' ? 'line-through' : 'none' }}>{s.programName}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">{s.coachName || 'Coach TBA'}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.status === 'Cancelled' ? 'Cancelled' : `${s.enrolled}/${s.capacity}`}</Typography>
                    </Box>
                  ))}
                  {!items.length && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>No sessions</Typography>}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Section>

      <ConfirmDialog
        open={!!leaving}
        title="Leave program?"
        message={leaving ? `You will be removed from ${leaving.programName}. You can enroll again later if slots are open.` : ''}
        confirmLabel="Leave"
        danger
        busy={!!busy}
        onClose={() => setLeaving(null)}
        onConfirm={() => act(leaving, 'leave')}
      />
    </Stack>
  );
}
