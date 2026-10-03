import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Button, Link, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AuthLayout from './AuthLayout';
import api, { errMsg } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Grid } from '../../components/ui';

export default function RegisterGym() {
  const navigate = useNavigate();
  const { acceptSession } = useAuth();
  const [f, setF] = useState({ gymName: '', firstName: '', lastName: '', email: '', phoneNumber: '', password: '', city: '', address: '', estimatedMembers: '100–300' });
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/auth/register-gym', f);
      if (data.pending) setDone(data.message);
      else {
        acceptSession(data);
        navigate('/admin/settings', { replace: true });
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout line1="Built for gym owners." accent="Designed for growth" sub="Register your gym to manage members, attendance, coaches, sales and reports in one place." wide>
      <Stack direction="row" justifyContent="space-between"><Link component={RouterLink} to="/" underline="hover" variant="body2">← Back</Link><Link component={RouterLink} to="/admin/login" underline="hover" variant="body2" fontWeight={700}>Administrator login</Link></Stack>
      <Typography variant="h4" textAlign="center" sx={{ mt: 2 }}>Are you a gym owner?</Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 2 }}>Create your gym's GYMORA account. You become its administrator.</Typography>
      {done ? <Alert severity="success">{done}</Alert> : (
        <Stack component="form" spacing={2} onSubmit={submit}>
          {error && <Alert severity="error">{error}</Alert>}
          <Grid cols={{ xs: 1, sm: 2 }}>
            <TextField label="Gym / business name" value={f.gymName} onChange={set('gymName')} required />
            <TextField label="City" value={f.city} onChange={set('city')} />
            <TextField label="Your first name" value={f.firstName} onChange={set('firstName')} required />
            <TextField label="Your last name" value={f.lastName} onChange={set('lastName')} required />
            <TextField label="Business email (your login)" type="email" value={f.email} onChange={set('email')} required />
            <TextField label="Phone" value={f.phoneNumber} onChange={set('phoneNumber')} />
            <TextField label="Password" type="password" value={f.password} onChange={set('password')} required inputProps={{ minLength: 8 }} helperText="At least 8 characters" />
            <TextField label="Address" value={f.address} onChange={set('address')} />
            <TextField select label="Estimated members" value={f.estimatedMembers} onChange={set('estimatedMembers')}>{['Under 100', '100–300', '300–1,000', '1,000+'].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}</TextField>
          </Grid>
          <Button type="submit" size="large" variant="contained" disabled={busy}>Register my gym</Button>
          <Typography variant="caption" color="text.secondary">We create starter membership plans and nutrition rules you can edit in Settings.</Typography>
        </Stack>
      )}
    </AuthLayout>
  );
}
