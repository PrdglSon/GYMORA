import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Link, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AuthLayout from './AuthLayout';
import api, { errMsg } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Grid } from '../../components/ui';
import { brand, DISPLAY_FONT } from '../../theme';
import { NameField, PhoneField } from '../../components/ContactFields';

export default function RegisterGym() {
  const navigate = useNavigate();
  const { acceptSession } = useAuth();
  const [f, setF] = useState({ gymName: '', firstName: '', lastName: '', email: '', phoneNumber: '', password: '', city: '', address: '', estimatedMembers: '100–300' });
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const [logo, setLogo] = useState(null);
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!logo) return setPreview('');
    const url = URL.createObjectURL(logo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);
  const pickLogo = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('The logo must be a JPG, PNG, WEBP or GIF image.');
    if (file.size > 5 * 1024 * 1024) return setError('The logo must be 5 MB or smaller.');
    setError('');
    setLogo(file);
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => fd.append(k, v));
      if (logo) fd.append('logo', logo);
      const { data } = await api.post('/auth/register-gym', fd);
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
            <NameField label="Your first name" value={f.firstName} onChange={set('firstName')} required />
            <NameField label="Your last name" value={f.lastName} onChange={set('lastName')} required />
            <TextField label="Business email (your login)" type="email" value={f.email} onChange={set('email')} required />
            <PhoneField label="Phone" value={f.phoneNumber} onChange={set('phoneNumber')} />
            <TextField label="Password" type="password" value={f.password} onChange={set('password')} required inputProps={{ minLength: 8 }} helperText="At least 8 characters" />
            <TextField label="Address" value={f.address} onChange={set('address')} />
            <TextField select label="Estimated members" value={f.estimatedMembers} onChange={set('estimatedMembers')}>{['Under 100', '100–300', '300–1,000', '1,000+'].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}</TextField>
          </Grid>
          <Box sx={{ p: 2, border: `1px dashed ${brand.line}`, borderRadius: 2.5 }}>
            <Typography fontWeight={800} variant="body2">Gym logo (optional)</Typography>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1.5 }}>Shown at the top of your gym's pages and portals. Without one, your gym name is shown instead. You can change it later in Settings.</Typography>
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
              <Box sx={{ height: 64, minWidth: 140, px: 1.5, display: 'grid', placeItems: 'center', bgcolor: '#fff', border: `1px solid ${brand.line}`, borderRadius: 2 }}>
                {preview ? <Box component="img" src={preview} alt="Logo preview" sx={{ maxHeight: 52, maxWidth: 180, objectFit: 'contain' }} /> : <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, textTransform: 'uppercase', fontSize: 18 }}>{f.gymName || 'Your gym name'}</Typography>}
              </Box>
              <Button component="label" variant="outlined" size="small">{logo ? 'Change logo' : 'Upload logo'}<input hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pickLogo} /></Button>
              {logo && <Button size="small" color="error" onClick={() => setLogo(null)}>Remove</Button>}
            </Stack>
          </Box>
          <Button type="submit" size="large" variant="contained" disabled={busy}>Register my gym</Button>
          <Typography variant="caption" color="text.secondary">We create starter membership plans and nutrition rules you can edit in Settings.</Typography>
        </Stack>
      )}
    </AuthLayout>
  );
}
