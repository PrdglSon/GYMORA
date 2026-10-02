import { useState } from 'react';
import { Button, Chip, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import useFetch from '../../hooks/useFetch';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Grid, Section, StatCard, StatusChip, Progress, Empty } from '../../components/ui';
import ProgramDialog from '../../components/ProgramDialog';
import RosterDialog from '../../components/RosterDialog';
import { fday, hhmm12 } from '../../utils/format';
import { brand } from '../../theme';

export default function CoachPrograms() {
  usePageTitle('Programs', 'Create, manage and organize your fitness programs.');
  const p = useFetch('/programs', { params: { mine: 'true' }, initial: [] });
  const [edit, setEdit] = useState(undefined);
  const [roster, setRoster] = useState(null);
  const list = p.data || [];
  const enrolled = list.reduce((a, x) => a + (x.enrolled || 0), 0);
  const fill = list.length ? Math.round((list.reduce((a, x) => a + (x.capacity ? x.enrolled / x.capacity : 0), 0) / list.length) * 100) : null;

  return (
    <Stack spacing={2}>
      <Grid cols={{ xs: 1, sm: 2, lg: 4 }}>
        <StatCard label="Total programs" value={list.length} />
        <StatCard label="Active programs" value={list.filter((x) => x.status === 'Active').length} />
        <StatCard label="Enrolled members" value={enrolled} />
        <StatCard label="Avg. fill rate" value={fill === null ? '—' : `${fill}%`} />
      </Grid>
      <Stack direction="row" justifyContent="flex-end"><Button variant="contained" startIcon={<AddIcon />} onClick={() => setEdit(null)}>New program</Button></Stack>
      <DataState {...p} onRetry={p.reload}>
        <Grid cols={{ xs: 1, sm: 2, lg: 3 }}>
          {list.map((x) => (
            <Section key={x._id}>
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Chip size="small" label={x.category} sx={{ bgcolor: brand.yellowSoft, color: brand.yellowInk }} />
                <StatusChip label={x.status} />
              </Stack>
              <Typography variant="h6" sx={{ mt: 1 }}>{x.programName}</Typography>
              <Typography variant="caption" color="text.secondary">{x.level}{x.durationWeeks ? ` · ${x.durationWeeks} weeks` : ''}</Typography>
              {x.description && <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>{x.description}</Typography>}
              <Typography variant="body2" fontWeight={600} sx={{ mt: 1 }}>{x.schedule || 'No schedule yet'}</Typography>
              <Typography variant="caption" color="text.secondary">{x.nextSession ? `Next: ${fday(x.nextSession.scheduleDate)}, ${hhmm12(x.nextSession.startTime)}` : 'No upcoming sessions'}</Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ my: 1.5 }}>
                <Progress value={x.capacity ? (x.enrolled / x.capacity) * 100 : 0} />
                <Typography variant="caption">{x.enrolled}/{x.capacity}</Typography>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" onClick={() => setRoster(x)}>View roster</Button>
                <Button size="small" variant="outlined" onClick={() => setEdit(x)}>Edit</Button>
              </Stack>
            </Section>
          ))}
        </Grid>
        {!list.length && <Empty>No programs yet. Create one, or ask an admin to assign one to you.</Empty>}
      </DataState>
      <ProgramDialog open={edit !== undefined} program={edit || null} onClose={() => setEdit(undefined)} onSaved={p.reload} isAdmin={false} />
      <RosterDialog open={!!roster} program={roster} onClose={() => setRoster(null)} />
    </Stack>
  );
}
