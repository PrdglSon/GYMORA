import { useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, InputAdornment, IconButton, Link, MenuItem, Stack, TextField, Typography } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import AuthLayout from './AuthLayout';
import { useAuth, homeFor, PORTALS } from '../../context/AuthContext';
import { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';

const COPY = {
  admin: { line1: 'Administrator', accent: 'login', sub: 'For gym owners and managers. Full access to members, coaches, programs, billing, reports, settings and audit logs.', note: 'Administrator accounts are created when a gym is registered, or by an existing administrator. Front-desk staff should use the Staff login.' },
  staff: { line1: 'Staff', accent: 'login', sub: 'For front-desk staff. Check members in, record payments and sales, restock products and answer support requests.', note: 'New staff accounts can log in once the gym administrator approves them. Owners and managers use the Administrator login.' },
  coach: { line1: 'Coach', accent: 'login', sub: 'See your schedule, clients and programs, update your availability and track client progress.', note: 'New coach accounts can log in once the gym administrator approves them.' },
  member: { line1: 'Welcome', accent: 'back', sub: 'Check in, join programs, track your progress and stay connected with your gym community.', note: 'New member? Find your gym on the home page and join online.' },
  platform: { line1: 'Platform', accent: 'admin', sub: 'Review gym registrations and manage gyms on the GYMORA platform.', note: 'For the GYMORA platform owner only.' },
};

export default function PortalLogin({ portal }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [f, setF] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get('expired') ? 'Your session expired. Please log in again.' : '');
  const [gyms, setGyms] = useState(null);
  const [gymSlug, setGymSlug] = useState(params.get('gym') || '');
  const copy = COPY[portal];
  const { data: gymInfo } = useFetch(gymSlug && portal !== 'platform' ? `/public/gyms/${gymSlug}` : null);
  const gymName = gymInfo?.gym?.name || gymInfo?.name;
  const info = PORTALS[portal];

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await login(portal, f.email, f.password, gymSlug || undefined);
      navigate(homeFor(data.role), { replace: true });
    } catch (err) {
      if (err.response?.status === 409 && err.response.data.gyms) {
        setGyms(err.response.data.gyms);
        setError('This email is registered at more than one gym. Choose the gym, then log in again.');
      } else setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout line1={copy.line1} accent={copy.accent} sub={copy.sub} badge={`${info.label} portal`}>
      <Stack direction="row" justifyContent="space-between">
        <Link component={RouterLink} to={gymSlug && portal !== 'platform' ? `/login?gym=${gymSlug}` : '/login'} underline="hover" variant="body2">← Back</Link>
        {portal === 'member' && <Link component={RouterLink} to="/" underline="hover" variant="body2" fontWeight={700}>Find a gym</Link>}
        {portal === 'admin' && <Link component={RouterLink} to="/own-a-gym" underline="hover" variant="body2" fontWeight={700}>Register a gym</Link>}
      </Stack>
      <Typography variant="h4" textAlign="center" sx={{ mt: 2 }}>{info.label} login</Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 2.5 }}>{gymName ? <>Sign in to <b>{gymName}</b></> : `Sign in with your ${info.label.toLowerCase()} account`}</Typography>
      <Stack component="form" spacing={2} onSubmit={submit}>
        {error && <Alert severity={gyms ? 'info' : 'error'}>{error}</Alert>}
        {gyms && (
          <TextField select label="Gym" value={gymSlug} onChange={(e) => setGymSlug(e.target.value)} required>
            {gyms.map((g) => <MenuItem key={g.slug} value={g.slug}>{g.name}</MenuItem>)}
          </TextField>
        )}
        <TextField label="Email address" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required autoComplete="username" />
        <TextField
          label="Password" type={show ? 'text' : 'password'} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required autoComplete="current-password"
          InputProps={{ endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} edge="end">{show ? <VisibilityOff /> : <Visibility />}</IconButton></InputAdornment> }}
        />
        <Box textAlign="right"><Link component={RouterLink} to={`/forgot-password?portal=${portal}`} variant="body2" fontWeight={700} underline="hover">Forgot password?</Link></Box>
        <Button type="submit" size="large" variant="contained" disabled={busy}>Login</Button>
        <Typography variant="caption" color="text.secondary" textAlign="center">{copy.note}</Typography>
        {gymSlug && ['member', 'coach', 'staff'].includes(portal) && (
          <Typography variant="body2" textAlign="center">
            No account yet? <Link component={RouterLink} to={portal === 'member' ? `/g/${gymSlug}/join` : portal === 'coach' ? `/g/${gymSlug}/apply` : `/g/${gymSlug}/staff-signup`} fontWeight={700}>Create one</Link>
          </Typography>
        )}
      </Stack>
    </AuthLayout>
  );
}
