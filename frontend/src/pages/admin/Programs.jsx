import { useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Grid, Section, StatCard, StatusChip, Progress, ConfirmDialog, Empty } from '../../components/ui';
import RosterDialog from '../../components/RosterDialog';
import { DOW, fday, fdate, hhmm12, isoDay, pct } from '../../utils/format';

const LEVELS = ['All Levels', 'Beginner', 'Intermediate', 'Advanced'];
const STATUSES = ['Active', 'Draft', 'Inactive'];

function ProgramForm({ open, program, coaches, onClose, onSaved }) {
  const { gym } = useAuth();
  const toast = useToast();
  const categories = gym?.settings?.programCategories || [];
  const [f, setF] = useState(null);
  const [gen, setGen] = useState(null);
  const [busy, setBusy] = useState(false);
  const init = () => {
    setF(program
      ? { programName: program.programName, category: program.category, description: program.description || '', coach: program.coach?._id || program.coach || '', capacity: program.capacity, durationWeeks: program.durationWeeks || '', level: program.level || 'All Levels', status: program.status }
      : { programName: '', category: categories[0] || '', description: '', coach: '', capacity: 20, durationWeeks: '', level: 'All Levels', status: 'Active' });
    setGen({ on: !program, days: [], startTime: '07:00', endTime: '08:00', weeks: 4, startDate: isoDay(), replaceUpcoming: false });
  };
  const submit = async (e) => {
    e.preventDefault();
    if (gen.on && !gen.days.length) {
      toast('Pick at least one day for the sessions.', 'error');
      return;
    }
    setBusy(true);
    try {
      const body = { ...f, capacity: Number(f.capacity), coach: f.coach || null };
      if (f.durationWeeks !== '') body.durationWeeks = Number(f.durationWeeks);
      else delete body.durationWeeks;
      if (!program && !body.coach) delete body.coach;
      if (gen.on) {
        body.generate = { days: gen.days, startTime: gen.startTime, endTime: gen.endTime, weeks: Number(gen.weeks), startDate: gen.startDate };
        if (program) body.replaceUpcoming = gen.replaceUpcoming;
      }
      const { data } = program ? await api.patch(`/programs/${program._id}`, body) : await api.post('/programs', body);
      toast(`${program ? 'Program updated' : 'Program created'}${data.sessionsCreated ? ` with ${data.sessionsCreated} sessions` : ''}`);
      onSaved();
      onClose();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth TransitionProps={{ onEnter: init }} PaperProps={{ component: 'form', onSubmit: submit }}>
      <DialogTitle>{program ? 'Edit program' : 'Add program'}</DialogTitle>
      <DialogContent>
        {f && gen && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Program name" value={f.programName} onChange={(e) => setF({ ...f, programName: e.target.value })} required />
            <Grid cols={{ xs: 1, sm: 2 }}>
              <TextField select label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} required>
                {[...new Set([...categories, f.category].filter(Boolean))].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
              <TextField select label="Coach" value={f.coach} onChange={(e) => setF({ ...f, coach: e.target.value })} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
                <MenuItem value="">Unassigned</MenuItem>
                {coaches.filter((c) => c.activeStatus === 'Active' || c._id === f.coach).map((c) => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}
              </TextField>
              <TextField label="Capacity" type="number" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} required inputProps={{ min: 1 }} />
              <TextField label="Duration (weeks)" type="number" value={f.durationWeeks} onChange={(e) => setF({ ...f, durationWeeks: e.target.value })} inputProps={{ min: 1 }} />
              <TextField select label="Level" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>{LEVELS.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}</TextField>
              <TextField select label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUSES.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}</TextField>
            </Grid>
            <TextField label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} multiline minRows={2} />
            {program?.schedule && <Typography variant="body2" color="text.secondary">Current schedule: <b>{program.schedule}</b></Typography>}
            <FormControlLabel control={<Checkbox checked={gen.on} onChange={(e) => setGen({ ...gen, on: e.target.checked })} />} label={program ? 'Generate new sessions' : 'Generate sessions now'} />
            {gen.on && (
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Repeat on</Typography>
                  <ToggleButtonGroup size="small" value={gen.days} onChange={(_, v) => setGen({ ...gen, days: v })} sx={{ flexWrap: 'wrap' }}>
                    {DOW.map((d, i) => <ToggleButton key={d} value={i}>{d}</ToggleButton>)}
                  </ToggleButtonGroup>
                </Box>
                <Grid cols={{ xs: 2, sm: 4 }}>
                  <TextField type="time" label="Start" value={gen.startTime} onChange={(e) => setGen({ ...gen, startTime: e.target.value })} InputLabelProps={{ shrink: true }} required />
                  <TextField type="time" label="End" value={gen.endTime} onChange={(e) => setGen({ ...gen, endTime: e.target.value })} InputLabelProps={{ shrink: true }} required />
                  <TextField type="date" label="Starting" value={gen.startDate} onChange={(e) => setGen({ ...gen, startDate: e.target.value })} InputLabelProps={{ shrink: true }} />
                  <TextField type="number" label="Weeks" value={gen.weeks} onChange={(e) => setGen({ ...gen, weeks: e.target.value })} inputProps={{ min: 1, max: 26 }} />
                </Grid>
                {program && <FormControlLabel control={<Checkbox checked={gen.replaceUpcoming} onChange={(e) => setGen({ ...gen, replaceUpcoming: e.target.checked })} />} label="Replace upcoming sessions (removes future sessions first)" />}
                {program && <Alert severity="info">Enrolled members are notified of the new schedule.</Alert>}
              </Stack>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={busy}>Save program</Button>
      </DialogActions>
    </Dialog>
  );
}

function Sessions({ programs }) {
  const toast = useToast();
  const [from, setFrom] = useState(isoDay());
  const [days, setDays] = useState(7);
  const [program, setProgram] = useState('');
  const s = useFetch('/programs/sessions', { params: { from, days, program: program || undefined } });
  const [cancel, setCancel] = useState(null);
  const [busy, setBusy] = useState(false);
  const list = s.data || [];
  const doCancel = async () => {
    setBusy(true);
    try {
      await api.patch(`/programs/schedules/${cancel._id}`, { status: 'Cancelled' });
      toast('Session cancelled. Enrolled members were notified.');
      setCancel(null);
      s.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const restore = async (x) => {
    try {
      await api.patch(`/programs/schedules/${x._id}`, { status: 'Scheduled' });
      toast('Session restored');
      s.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };
  return (
    <Section title="Sessions">
      <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
        <TextField type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value || isoDay())} InputLabelProps={{ shrink: true }} sx={{ width: 170 }} />
        <TextField select label="Range" value={days} onChange={(e) => setDays(e.target.value)} sx={{ width: 130 }}>
          {[[7, '1 week'], [14, '2 weeks'], [31, '1 month']].map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
        </TextField>
        <TextField select label="Program" value={program} onChange={(e) => setProgram(e.target.value)} sx={{ width: 220 }} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
          <MenuItem value="">All programs</MenuItem>
          {programs.map((p) => <MenuItem key={p._id} value={p._id}>{p.programName}</MenuItem>)}
        </TextField>
      </Stack>
      <DataState {...s} onRetry={s.reload}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Time</TableCell><TableCell>Program</TableCell><TableCell>Coach</TableCell><TableCell>Enrolled</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {list.map((x) => (
                <TableRow key={x._id} sx={{ opacity: x.state === 'Cancelled' ? 0.6 : 1 }}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{fday(x.scheduleDate)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{hhmm12(x.startTime)} – {hhmm12(x.endTime)}</TableCell>
                  <TableCell><b>{x.programName}</b><Typography variant="caption" display="block" color="text.secondary">{x.category}</Typography></TableCell>
                  <TableCell>{x.coachName || '—'}</TableCell>
                  <TableCell>{x.enrolled}/{x.capacity}</TableCell>
                  <TableCell><StatusChip label={x.state} /></TableCell>
                  <TableCell>
                    {x.status === 'Cancelled'
                      ? x.state === 'Cancelled' && new Date(x.end) > new Date() && <Button size="small" variant="outlined" onClick={() => restore(x)}>Restore</Button>
                      : x.state === 'Upcoming' && <Button size="small" color="error" onClick={() => setCancel(x)}>Cancel</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!list.length && <Empty>No sessions in this range.</Empty>}
        </Box>
      </DataState>
      <ConfirmDialog open={!!cancel} title="Cancel this session?" message={cancel ? `${cancel.programName} on ${fdate(cancel.scheduleDate)} at ${hhmm12(cancel.startTime)}. Enrolled members will be notified.` : ''} confirmLabel="Cancel session" danger busy={busy} onClose={() => setCancel(null)} onConfirm={doCancel} />
    </Section>
  );
}

export default function Programs() {
  usePageTitle('Programs', 'Create programs, assign coaches, generate sessions and track enrollment.');
  const toast = useToast();
  const p = useFetch('/programs', { initial: [] });
  const coaches = useFetch('/coaches', { initial: [] });
  const [tab, setTab] = useState(0);
  const [edit, setEdit] = useState(undefined);
  const [roster, setRoster] = useState(null);
  const [del, setDel] = useState(null);
  const list = p.data || [];
  const remove = async () => {
    try {
      const { data } = await api.delete(`/programs/${del._id}`);
      toast(data.deactivated ? 'Program has enrolled members, so it was set to Inactive.' : 'Program deleted');
      setDel(null);
      p.reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };
  return (
    <Stack spacing={2}>
      <Grid cols={{ xs: 1, sm: 2, lg: 4 }}>
        <StatCard label="Total programs" value={list.length} />
        <StatCard label="Active programs" value={list.filter((x) => x.status === 'Active').length} />
        <StatCard label="Total enrollments" value={list.reduce((a, x) => a + x.enrolled, 0)} />
        <StatCard label="Avg. fill rate" value={list.length ? `${Math.round((list.reduce((a, x) => a + x.enrolled / (x.capacity || 1), 0) / list.length) * 100)}%` : '—'} />
      </Grid>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}><Tab label="Programs" /><Tab label="Sessions" /></Tabs>
      {tab === 0 && (
        <Section title="All programs" action={<Button variant="contained" onClick={() => setEdit(null)}>+ Add program</Button>}>
          <DataState {...p} onRetry={p.reload}>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead><TableRow><TableCell>Program</TableCell><TableCell>Category</TableCell><TableCell>Coach</TableCell><TableCell>Schedule</TableCell><TableCell>Enrolled</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
                <TableBody>
                  {list.map((x) => (
                    <TableRow key={x._id}>
                      <TableCell><b>{x.programName}</b><Typography variant="caption" display="block" color="text.secondary">{x.level}{x.durationWeeks ? ` · ${x.durationWeeks} weeks` : ''}</Typography></TableCell>
                      <TableCell>{x.category}</TableCell>
                      <TableCell>{x.coachName || '—'}{x.coachAvailability && <Box><StatusChip label={x.coachAvailability} /></Box>}</TableCell>
                      <TableCell>
                        {x.schedule || '—'}
                        {x.nextSession && <Typography variant="caption" display="block" color="text.secondary">Next: {fday(x.nextSession.scheduleDate)} {hhmm12(x.nextSession.startTime)}</Typography>}
                      </TableCell>
                      <TableCell><Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 120 }}><Progress value={pct(x.enrolled, x.capacity)} /><Typography variant="caption">{x.enrolled}/{x.capacity}</Typography></Stack></TableCell>
                      <TableCell><StatusChip label={x.status} /></TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="outlined" onClick={() => setRoster(x)}>Roster</Button>
                          <Button size="small" variant="outlined" onClick={() => setEdit(x)}>Edit</Button>
                          <Button size="small" color="error" onClick={() => setDel(x)}>Delete</Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!list.length && <Empty>No programs yet.</Empty>}
            </Box>
          </DataState>
        </Section>
      )}
      {tab === 1 && <Sessions programs={list} />}
      <ProgramForm open={edit !== undefined} program={edit} coaches={coaches.data || []} onClose={() => setEdit(undefined)} onSaved={p.reload} />
      <RosterDialog open={!!roster} program={roster} onClose={() => setRoster(null)} />
      <ConfirmDialog open={!!del} title={`Delete ${del?.programName}?`} message="Programs with enrolled members are set to Inactive instead of deleted." confirmLabel="Delete" danger onClose={() => setDel(null)} onConfirm={remove} />
    </Stack>
  );
}
