import { useEffect, useState } from 'react';
import { Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import PhotoCameraOutlined from '@mui/icons-material/PhotoCameraOutlined';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Grid, Section, StatusChip, UserAvatar } from '../../components/ui';
import { brand } from '../../theme';

export default function CoachProfile() {
  usePageTitle('My Profile', 'Manage your personal information and specializations.');
  const { gym, refresh } = useAuth();
  const toast = useToast();
  const me = useFetch('/coaches/me');
  const [f, setF] = useState(null);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const c = me.data;

  useEffect(() => {
    if (c) setF({ firstName: c.firstName || '', lastName: c.lastName || '', phoneNumber: c.phoneNumber || '', certification: c.certification || '', experience: c.experience ?? 0, bio: c.bio || '', specializations: c.specializations || [] });
  }, [c]);

  const options = [...new Set([...(gym?.settings?.specializations || []), ...(f?.specializations || [])])];
  const toggle = (s) => setF({ ...f, specializations: f.specializations.includes(s) ? f.specializations.filter((x) => x !== s) : [...f.specializations, s] });
  const addCustom = () => {
    const v = custom.trim();
    if (v && !f.specializations.includes(v)) setF({ ...f, specializations: [...f.specializations, v] });
    setCustom('');
  };

  const save = async (e) => {
    e.preventDefault();
    if (!f.specializations.length) return toast('Pick at least one specialization.', 'error');
    setBusy(true);
    try {
      const { data } = await api.patch('/coaches/me', { ...f, experience: Number(f.experience) || 0 });
      me.setData(data);
      await refresh();
      toast('Profile saved. Coach matching now uses your specializations.');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const avatar = async (file) => {
    const fd = new FormData();
    fd.append('avatar', file);
    setUploading(true);
    try {
      const { data } = await api.patch('/auth/account', fd);
      me.setData({ ...c, avatarUrl: data.account?.avatarUrl });
      await refresh();
      toast('Photo updated');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <DataState {...me} onRetry={me.reload}>
      {c && f && (
        <Grid cols={{ xs: 1, md: '1fr 2fr' }} sx={{ alignItems: 'start' }}>
          <Section>
            <Stack alignItems="center" spacing={1} sx={{ textAlign: 'center' }}>
              <UserAvatar name={c.name} src={c.avatarUrl} size={88} />
              <Typography fontWeight={800} fontSize={18}>{c.name}</Typography>
              <Typography variant="body2" color="text.secondary">{c.email}</Typography>
              <StatusChip label={c.availabilityStatus} />
              <Typography variant="body2" color="text.secondary">{c.experience || 0} yr{c.experience === 1 ? '' : 's'} experience{c.certification ? ` · ${c.certification}` : ''}</Typography>
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5} justifyContent="center">
                {c.specializations.map((s) => <Chip key={s} size="small" label={s} sx={{ bgcolor: brand.yellowSoft, color: brand.yellowInk }} />)}
              </Stack>
              <Button component="label" size="small" variant="outlined" startIcon={<PhotoCameraOutlined />} disabled={uploading}>
                {uploading ? 'Uploading…' : 'Change photo'}
                <input hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => { const file = e.target.files[0]; e.target.value = ''; if (file) avatar(file); }} />
              </Button>
            </Stack>
          </Section>
          <Section title="Profile & specializations">
            <Stack component="form" spacing={2} onSubmit={save}>
              <Grid cols={{ xs: 1, sm: 2 }}>
                <TextField label="First name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} required />
                <TextField label="Last name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} required />
                <TextField label="Phone number" value={f.phoneNumber} onChange={(e) => setF({ ...f, phoneNumber: e.target.value })} />
                <TextField label="Years of experience" type="number" value={f.experience} onChange={(e) => setF({ ...f, experience: e.target.value })} inputProps={{ min: 0, max: 60 }} />
              </Grid>
              <TextField label="Certification" value={f.certification} onChange={(e) => setF({ ...f, certification: e.target.value })} placeholder="e.g. NASM-CPT, PRC Fitness Instructor" />
              <TextField label="Bio" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} multiline minRows={3} placeholder="Tell members about your coaching style" />
              <Box>
                <Typography variant="body2" fontWeight={700}>Specializations</Typography>
                <Typography variant="caption" color="text.secondary">Used by the rule-based coach matching to suggest you to members with matching goals.</Typography>
                <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mt: 1 }}>
                  {options.map((s) => {
                    const on = f.specializations.includes(s);
                    return <Chip key={s} label={s} onClick={() => toggle(s)} variant={on ? 'filled' : 'outlined'} sx={on ? { bgcolor: brand.yellow, color: '#fff', '&:hover': { bgcolor: '#E09A00' } } : {}} />;
                  })}
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 1.5, maxWidth: 360 }}>
                  <TextField size="small" placeholder="Add another specialization" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} inputProps={{ 'aria-label': 'Add specialization' }} />
                  <Button variant="outlined" onClick={addCustom}>Add</Button>
                </Stack>
              </Box>
              <Button type="submit" variant="contained" disabled={busy} sx={{ alignSelf: 'flex-start' }}>Save profile</Button>
            </Stack>
          </Section>
        </Grid>
      )}
    </DataState>
  );
}
