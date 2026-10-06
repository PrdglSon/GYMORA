import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Alert, Button, Link, Stack, TextField, Typography } from '@mui/material';
import AuthLayout from '../auth/AuthLayout';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { Grid } from '../../components/ui';

const EMPTY = { firstName: '', lastName: '', email: '', phoneNumber: '', password: '', confirm: '' };

export default function StaffSignup() {
  const { slug } = useParams();
  const { data } = useFetch(`/public/gyms/${slug}`);
  const gymName = data?.gym?.name || 'this gym';
  const [f, setF] = useState(EMPTY);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (f.password !== f.confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      const { confirm, ...body } = f;
      const { data: r } = await api.post(`/public/gyms/${slug}/staff-signup`, body);
      setDone(r.message);
      setF(EMPTY);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout gym={data?.gym} line1="Join the" accent="front desk" sub={`Create your staff account at ${gymName}. You can log in once the gym administrator approves it.`} badge="Staff sign-up">
      <Stack direction="row" justifyContent="space-between">
        <Link component={RouterLink} to={`/login?gym=${slug}`} underline="hover" variant="body2">← Back</Link>
        <Link component={RouterLink} to={`/staff/login?gym=${slug}`} underline="hover" variant="body2" fontWeight={700}>Staff login</Link>
      </Stack>
      <Typography variant="h4" textAlign="center" sx={{ mt: 2 }}>Create a staff account</Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 2 }}>at <b>{gymName}</b></Typography>
      {done ? (
        <Stack spacing={2}>
          <Alert severity="success">{done}</Alert>
          <Button variant="contained" component={RouterLink} to={`/staff/login?gym=${slug}`}>Go to staff login</Button>
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
          </Grid>
          <Button type="submit" size="large" variant="contained" disabled={busy}>Create staff account</Button>
          <Typography variant="caption" color="text.secondary" textAlign="center">Staff accounts are for the front desk. Administrator accounts can only be given by the gym's administrator.</Typography>
        </Stack>
      )}
    </AuthLayout>
  );
}
