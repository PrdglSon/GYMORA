import { useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Alert, Button, Link, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AuthLayout from './AuthLayout';
import api, { errMsg } from '../../api';
import { PORTALS } from '../../context/AuthContext';

export default function ForgotPassword() {
  const [params] = useSearchParams();
  const [portal, setPortal] = useState(PORTALS[params.get('portal')] ? params.get('portal') : 'member');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/forgot', { portal, email });
      setMsg(data.message);
    } catch (err) {
      setError(errMsg(err));
    }
  };
  return (
    <AuthLayout line1="Forgot your" accent="password?" sub="Enter your email and we will send you a link to set a new one.">
      <Link component={RouterLink} to={`/${portal}/login${params.get('gym') ? `?gym=${params.get('gym')}` : ''}`} underline="hover" variant="body2">← Back to login</Link>
      <Typography variant="h4" sx={{ my: 2 }}>Reset password</Typography>
      {msg ? <Alert severity="success">{msg}</Alert> : (
        <Stack component="form" spacing={2} onSubmit={submit}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField select label="Account type" value={portal} onChange={(e) => setPortal(e.target.value)}>
            {Object.entries(PORTALS).map(([k, p]) => <MenuItem key={k} value={k}>{p.label}</MenuItem>)}
          </TextField>
          <TextField label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" variant="contained" size="large">Send reset link</Button>
        </Stack>
      )}
    </AuthLayout>
  );
}
