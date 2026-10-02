import { useEffect, useState } from 'react';
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import dayjs from 'dayjs';
import api, { errMsg } from '../api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { DOW, isoDay } from '../utils/format';
import { Grid } from './ui';
import { brand } from '../theme';

const LEVELS = ['All Levels', 'Beginner', 'Intermediate', 'Advanced'];
const STATUSES = ['Active', 'Draft', 'Inactive'];
const blank = (cat) => ({ programName: '', category: cat, description: '', coach: '', capacity: 20, durationWeeks: '', level: 'All Levels', status: 'Active', imageUrl: '' });
const blankGen = () => ({ days: [1, 3, 5], startTime: '18:00', endTime: '19:00', weeks: 4, startDate: isoDay() });

export default function ProgramDialog({ open, onClose, onSaved, program, coaches = [], isAdmin }) {
  const { gym, role } = useAuth();
  const toast = useToast();
  const admin = isAdmin ?? role === 'admin';
  const categories = gym?.settings?.programCategories?.length ? gym.settings.programCategories : ['Strength Training', 'HIIT', 'Yoga'];
  const [f, setF] = useState(blank(categories[0]));
  const [gen, setGen] = useState(blankGen());
  const [generate, setGenerate] = useState(true);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (program) {
      setF({
        programName: program.programName || '', category: program.category || categories[0], description: program.description || '',
        coach: program.coach?._id || program.coach || '', capacity: program.capacity ?? 20, durationWeeks: program.durationWeeks ?? '',
        level: program.level || 'All Levels', status: program.status || 'Active', imageUrl: program.imageUrl || '',
      });
      setGenerate(false);
    } else {
      setF(blank(categories[0]));
      setGenerate(true);
    }
    setGen(blankGen());
    setReplace(false);
  }, [open, program]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setG = (k) => (e) => setGen({ ...gen, [k]: e.target.value });
  const allCats = [...new Set([...categories, f.category].filter(Boolean))];
  const sessionsPreview = (() => {
    if (!generate || !gen.days.length) return 0;
    const from = dayjs(gen.startDate || undefined);
    let n = 0;
    for (let i = 0; i < Math.min(Number(gen.weeks) || 4, 26) * 7; i++) if (gen.days.includes(from.add(i, 'day').day())) n++;
    return n;
  })();

  const submit = async (e) => {
    e.preventDefault();
    if (generate) {
      if (!gen.days.length) return toast('Pick at least one day for the sessions.', 'error');
      if (gen.endTime <= gen.startTime) return toast('End time must be after start time.', 'error');
    }
    const body = {
      programName: f.programName.trim(), category: f.category, description: f.description, capacity: Number(f.capacity) || 1,
      level: f.level, status: f.status, durationWeeks: f.durationWeeks === '' ? undefined : Number(f.durationWeeks),
    };
    if (f.imageUrl) body.imageUrl = f.imageUrl;
    if (admin) body.coach = f.coach || null;
    if (generate) {
      body.generate = { days: gen.days, startTime: gen.startTime, endTime: gen.endTime, weeks: Number(gen.weeks) || 4, startDate: gen.startDate };
      if (program) body.replaceUpcoming = replace;
    }
    setBusy(true);
    try {
      const { data } = program ? await api.patch(`/programs/${program._id}`, body) : await api.post('/programs', body);
      toast(data.sessionsCreated ? `Program saved with ${data.sessionsCreated} sessions` : 'Program saved');
      onSaved?.(data.program);
      onClose();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: submit }}>
      <DialogTitle>{program ? 'Edit program' : 'New program'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Program name" value={f.programName} onChange={set('programName')} required />
          <Grid cols={{ xs: 1, sm: 2 }}>
            <TextField select label="Category" value={f.category} onChange={set('category')} required>
              {allCats.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            {admin && (
              <TextField select label="Coach" value={f.coach} onChange={set('coach')}>
                <MenuItem value="">Unassigned</MenuItem>
                {coaches.map((c) => <MenuItem key={c._id} value={c._id}>{c.name || `${c.firstName} ${c.lastName}`}</MenuItem>)}
              </TextField>
            )}
            <TextField select label="Level" value={f.level} onChange={set('level')}>{LEVELS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField>
            <TextField select label="Status" value={f.status} onChange={set('status')}>{STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField>
            <TextField type="number" label="Capacity" value={f.capacity} onChange={set('capacity')} inputProps={{ min: 1 }} required />
            <TextField type="number" label="Duration (weeks, optional)" value={f.durationWeeks} onChange={set('durationWeeks')} inputProps={{ min: 1 }} />
          </Grid>
          <TextField label="Description" value={f.description} onChange={set('description')} multiline minRows={2} />
          {program?.schedule && <Typography variant="body2" color="text.secondary">Current schedule: <b>{program.schedule}</b></Typography>}
          <FormControlLabel control={<Switch checked={generate} onChange={(e) => setGenerate(e.target.checked)} />} label={program ? 'Add sessions to the calendar' : 'Generate sessions on the calendar'} />
          {generate && (
            <Box sx={{ border: `1px solid ${brand.line}`, borderRadius: 2, p: 1.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>Repeat on</Typography>
              <ToggleButtonGroup size="small" value={gen.days} onChange={(_, v) => setGen({ ...gen, days: [...v].sort() })} sx={{ display: 'flex', flexWrap: 'wrap', mt: 0.5, mb: 1.5 }}>
                {DOW.map((d, i) => <ToggleButton key={d} value={i} sx={{ flex: 1, minWidth: 44, fontWeight: 700, '&.Mui-selected': { bgcolor: brand.yellowSoft, color: brand.yellowInk } }}>{d}</ToggleButton>)}
              </ToggleButtonGroup>
              <Grid cols={{ xs: 2, sm: 4 }}>
                <TextField type="time" label="Start" value={gen.startTime} onChange={setG('startTime')} InputLabelProps={{ shrink: true }} required />
                <TextField type="time" label="End" value={gen.endTime} onChange={setG('endTime')} InputLabelProps={{ shrink: true }} required />
                <TextField type="number" label="Weeks" value={gen.weeks} onChange={setG('weeks')} inputProps={{ min: 1, max: 26 }} required />
                <TextField type="date" label="Starting" value={gen.startDate} onChange={setG('startDate')} InputLabelProps={{ shrink: true }} required />
              </Grid>
              {program && <FormControlLabel sx={{ mt: 1 }} control={<Checkbox size="small" checked={replace} onChange={(e) => setReplace(e.target.checked)} />} label="Replace all upcoming sessions" />}
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                {sessionsPreview} session{sessionsPreview === 1 ? '' : 's'} will be created.{program ? ' Enrolled members are notified of the new schedule.' : ''}
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={busy}>{program ? 'Save changes' : 'Create program'}</Button>
      </DialogActions>
    </Dialog>
  );
}
