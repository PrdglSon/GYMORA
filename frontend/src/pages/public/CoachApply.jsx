import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Alert, Button, Checkbox, FormControlLabel, FormGroup, FormLabel, Link, Stack, TextField, Typography } from '@mui/material';
import AuthLayout from '../auth/AuthLayout';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { Grid } from '../../components/ui';

const FALLBACK_SPECS = ['Strength Training', 'HIIT', 'Yoga', 'Pilates', 'Zumba', 'Functional Fitness', 'Bodybuilding', 'Personal Coaching', 'Muay Thai'];
const EMPTY = { firstName: '', lastName: '', email: '', phoneNumber: '', password: '', confirm: '', experience: '', certification: '', bio: '', specializations: [] };

export default function CoachApply() {
  const { slug } = useParams();
  const { data } = useFetch(`/public/gyms/${slug}`);
  const gymName = data?.gym?.name || 'this gym';
  const specs = data?.gym?.settings?.specializations?.length ? data.gym.settings.specializations : FALLBACK_SPECS;
  const [f, setF] = useState(EMPTY);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (s) => setF({ ...f, specializations: f.specializations.includes(s) ? f.specializations.filter((x) => x !== s) : [...f.specializations, s] });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (f.password !== f.confirm) return setError('Passwords do not match.');
    if (!f.specializations.length) return setError('Pick at least one specialization.');
    setBusy(true);
    try {
      const { confirm, ...body } = f;
      const { data: r } = await api.post(`/public/gyms/${slug}/coach-signup`, { ...body, experience: f.experience === '' ? 0 : Number(f.experience) });
      setDone(r.message);
      setF(EMPTY);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout gym={data?.gym} line1="Inspire. Coach." accent="Transform." sub={`Create your coach account at ${gymName}. You can log in once the gym administrator approves it.`} badge="Coach sign-up" wide>
      <Stack direction="row" justifyContent="space-between">
        <Link component={RouterLink} to={`/login?gym=${slug}`} underline="hover" variant="body2">← Back</Link>
        <Link component={RouterLink} to={`/coach/login?gym=${slug}`} underline="hover" variant="body2" fontWeight={700}>Coach login</Link>
      </Stack>
      <Typography variant="h4" textAlign="center" sx={{ mt: 2 }}>Create a coach account</Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 2 }}>at <b>{gymName}</b></Typography>
      {done ? (
        <Stack spacing={2}>
          <Alert severity="success">{done}</Alert>
          <Button variant="contained" component={RouterLink} to={`/coach/login?gym=${slug}`}>Go to coach login</Button>
        </Stack>
      ) : (
        <Stack component="form" spacing={2} onSubmit={submit}>
          {error && <Alert severity="error">{error}</Alert>}
          <Grid cols={{ xs: 1, sm: 2 }}>
            <TextField label="First name" value={f.firstName} onChange={set('firstName')} required />
            <TextField label="Last name" value={f.lastName} onChange={set('lastName')} required />
            <TextField label="Email (your login)" type="email" value={f.email} onChange={set('email')} required />
            <TextField label="Phone number" value={f.phoneNumber} onChange={set('phoneNumber')} required />
            <TextField label="Password" type="password" value={f.password} onChange={set('password')} required inputProps={{ minLength: 8 }} helperText="At least 8 characters" autoComplete="new-password" />
            <TextField label="Confirm password" type="password" value={f.confirm} onChange={set('confirm')} required autoComplete="new-password" />
            <TextField label="Years of experience" type="number" value={f.experience} onChange={set('experience')} inputProps={{ min: 0 }} required />
            <TextField label="Certification" value={f.certification} onChange={set('certification')} placeholder="e.g. NASM-CPT" />
          </Grid>
          <FormGroup>
            <FormLabel sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary', mb: 0.5 }}>Specializations</FormLabel>
            <Grid cols={{ xs: 1, sm: 3 }} gap={0}>
              {specs.map((s) => <FormControlLabel key={s} control={<Checkbox size="small" checked={f.specializations.includes(s)} onChange={() => toggle(s)} />} label={<Typography variant="body2">{s}</Typography>} />)}
            </Grid>
          </FormGroup>
          <TextField label="Short bio" value={f.bio} onChange={set('bio')} multiline minRows={2} />
          <Button type="submit" size="large" variant="contained" disabled={busy}>Create coach account</Button>
        </Stack>
      )}
    </AuthLayout>
  );
}
