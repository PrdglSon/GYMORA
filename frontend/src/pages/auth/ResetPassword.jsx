import { useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Alert, Button, Link, Stack, TextField, Typography } from '@mui/material';
import AuthLayout from './AuthLayout';
import api, { errMsg } from '../../api';

const LOGIN = { StaffAdmin: '/login', Member: '/member/login', Coach: '/coach/login', PlatformAdmin: '/platform/login' };

export default function ResetPassword() {
  const [params] = useSearchParams();
  const type = params.get('type') || 'Member';
  const portal = params.get('portal');
  const gym = params.get('gym');
  const loginTo = portal ? `/${portal}/login${gym ? `?gym=${gym}` : ''}` : LOGIN[type] || '/login';
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (pw !== pw2) return setError('Passwords do not match.');
    try {
      const { data } = await api.post('/auth/reset', { type, token: params.get('token'), password: pw });
      setMsg(data.message);
    } catch (err) {
      setError(errMsg(err));
    }
  };
  return (
    <AuthLayout line1="Set a new" accent="password" sub="Choose a password with at least 8 characters.">
      <Typography variant="h4" sx={{ mb: 2 }}>New password</Typography>
      {msg ? (
        <Alert severity="success" action={<Link component={RouterLink} to={loginTo} fontWeight={700}>Log in</Link>}>{msg}</Alert>
      ) : (
        <Stack component="form" spacing={2} onSubmit={submit}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="New password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required inputProps={{ minLength: 8 }} />
          <TextField label="Confirm password" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
          <Button type="submit" variant="contained" size="large">Save password</Button>
        </Stack>
      )}
    </AuthLayout>
  );
}
