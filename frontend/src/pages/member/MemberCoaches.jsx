import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../context/SocketContext';
import { usePageTitle } from '../../components/AppShell';
import { Banner, ConfirmDialog, DataState, Grid, Section, StatusChip, UserAvatar, Empty } from '../../components/ui';
import { brand } from '../../theme';

const GOALS = ['Weight Loss', 'Muscle Gain', 'Strength', 'General Fitness', 'Endurance', 'Flexibility'];
const AVAIL_POINTS = { Available: 15, 'In Session': 5, Unavailable: 0 };

function CoachCard({ coach, matched = [], score, mine, highlight, onChoose }) {
  const navigate = useNavigate();
  return (
    <Section sx={{ bgcolor: highlight ? brand.yellowSoft : '#fff' }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <UserAvatar name={coach.name} src={coach.avatarUrl} size={44} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={800} noWrap>{coach.name}</Typography>
          <Typography variant="caption" color="text.secondary" display="block" noWrap>
            {coach.experience ? `${coach.experience} yr${coach.experience === 1 ? '' : 's'} experience` : 'New coach'}
            {coach.certification ? ` · ${coach.certification}` : ''}
          </Typography>
        </Box>
        <StatusChip label={coach.availabilityStatus || 'Unavailable'} />
      </Stack>
      {coach.bio && <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>{coach.bio}</Typography>}
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ my: 1.5 }}>
        {(coach.specializations || []).map((s) => (
          <Chip key={s} size="small" label={s} sx={matched.includes(s) ? { bgcolor: brand.yellow, color: '#fff' } : undefined} />
        ))}
        {!coach.specializations?.length && <Typography variant="caption" color="text.secondary">No specializations listed</Typography>}
      </Stack>
      {score != null && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Score {score} = {matched.length} matching × 30 + {AVAIL_POINTS[coach.availabilityStatus] ?? 0} availability + {Math.min(coach.experience || 0, 10)} experience
        </Typography>
      )}
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        {mine ? (
          <>
            <StatusChip label="Your coach" color="green" />
            <Stack direction="row" spacing={0.5}>
              <Button size="small" onClick={() => navigate('/member/messages')}>Message</Button>
              <Button size="small" variant="contained" onClick={() => navigate(`/member/bookings?coach=${coach._id}`)}>Book a session</Button>
            </Stack>
          </>
        ) : (
          <Stack direction="row" spacing={0.5}>
            <Button size="small" onClick={() => navigate(`/member/bookings?coach=${coach._id}`)}>Book a session</Button>
            <Button size="small" variant="contained" onClick={() => onChoose(coach)}>Choose coach</Button>
          </Stack>
        )}
      </Stack>
    </Section>
  );
}

export default function MemberCoaches() {
  usePageTitle('Find a Coach', 'Coaches matched to your fitness goal.');
  const toast = useToast();
  const { account, refresh } = useAuth();
  const [goal, setGoal] = useState('');
  const match = useFetch('/coaches/match', { params: goal ? { goal } : {} });
  const coaches = useFetch('/coaches', { initial: [] });
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);

  useSocketEvent('coach:availability', (p) => {
    if (!p?.coachId) return;
    const upd = (c) => (String(c._id) === String(p.coachId) ? { ...c, availabilityStatus: p.availabilityStatus } : c);
    coaches.setData((list) => (list || []).map(upd));
    match.setData((d) => (d ? { ...d, results: d.results.map((x) => ({ ...x, coach: upd(x.coach) })) } : d));
  });

  const myId = String(account?.assignedCoach || '');
  const current = match.data?.goal || account?.fitnessGoal || 'General Fitness';

  const choose = async () => {
    setBusy(true);
    try {
      await api.post(`/coaches/${picked._id}/choose`);
      toast(`${picked.name} is now your coach`);
      setPicked(null);
      await refresh();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Banner line1="Train with the" accent="right coach" rest="for you." sub="We rank coaches with simple rules based on your goal, their availability and experience." />

      <Section
        title={<span>Best matches for <Box component="span" sx={{ color: brand.yellow }}>{current}</Box></span>}
        action={
          <TextField select label="Fitness goal" value={goal || current} onChange={(e) => setGoal(e.target.value)} sx={{ minWidth: 200 }} fullWidth={false}>
            {GOALS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
          </TextField>
        }
      >
        <Alert severity="info" sx={{ mb: 2 }}>
          How matching works: each coach gets 30 points for every specialization that fits your goal, 15 points if Available (5 if In Session), and 1 point per year of experience (up to 10). Highlighted tags are the specializations that fit. Your saved goal can be changed in Profile.
        </Alert>
        <DataState {...match} onRetry={match.reload}>
          {match.data?.results?.length ? (
            <Grid cols={{ xs: 1, md: 2, lg: 3 }}>
              {match.data.results.map(({ coach, matched, score }, i) => (
                <CoachCard key={coach._id} coach={coach} matched={matched} score={score} highlight={i === 0} mine={myId === String(coach._id)} onChoose={setPicked} />
              ))}
            </Grid>
          ) : (
            <Empty>No active coaches yet.</Empty>
          )}
        </DataState>
      </Section>

      <Section title="All coaches">
        <DataState {...coaches} onRetry={coaches.reload}>
          {coaches.data?.length ? (
            <Grid cols={{ xs: 1, md: 2, lg: 3 }}>
              {coaches.data.map((c) => (
                <CoachCard key={c._id} coach={c} mine={myId === String(c._id)} onChoose={setPicked} />
              ))}
            </Grid>
          ) : (
            <Empty>No coaches listed.</Empty>
          )}
        </DataState>
      </Section>

      <ConfirmDialog
        open={!!picked}
        title="Choose this coach?"
        message={picked ? `${picked.name} will be your assigned coach and will be notified.${myId ? ' This replaces your current coach.' : ''}` : ''}
        confirmLabel="Choose coach"
        busy={busy}
        onClose={() => setPicked(null)}
        onConfirm={choose}
      />
    </Stack>
  );
}
