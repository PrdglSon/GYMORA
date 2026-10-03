import { useEffect, useState } from 'react';
import { Alert, Box, Button, LinearProgress, Link, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import api, { errMsg, fileUrl } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePageTitle } from '../../components/AppShell';
import { ConfirmDialog, DataState, Grid, Section, StatusChip, UserAvatar } from '../../components/ui';
import { fdate } from '../../utils/format';

function LiveQr({ refreshKey }) {
  const [qr, setQr] = useState(null);
  const [left, setLeft] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer;
    let tick;
    const load = async () => {
      try {
        const { data } = await api.get('/members/me/qr-live');
        if (!alive) return;
        setFailed(false);
        setQr(data);
        const until = Date.now() + data.expiresInMs;
        clearInterval(tick);
        const update = () => setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
        update();
        tick = setInterval(update, 1000);
        timer = setTimeout(load, data.expiresInMs + 300);
      } catch {
        if (!alive) return;
        setFailed(true);
        timer = setTimeout(load, 5000);
      }
    };
    load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timer);
        load();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshKey]);

  if (!qr) return <Typography variant="body2" sx={{ p: 4 }}>{failed ? 'Cannot load your QR code. Check your internet.' : 'Loading…'}</Typography>;
  return (
    <Box sx={{ width: 170 }}>
      <Box sx={{ opacity: failed ? 0.25 : 1 }}><QRCodeSVG value={qr.code} size={170} /></Box>
      <LinearProgress variant="determinate" value={(left / qr.stepSec) * 100} sx={{ mt: 1, height: 6, borderRadius: 3 }} />
      <Typography variant="caption" color="text.secondary" component="div" textAlign="center">{failed ? 'Offline: code not updating' : `New code in ${left}s`}</Typography>
    </Box>
  );
}

const GOALS = ['Weight Loss', 'Muscle Gain', 'Strength', 'General Fitness', 'Endurance', 'Flexibility'];
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const STUDENT_LABEL = { none: 'Not submitted', pending: 'Pending', verified: 'Verified', rejected: 'Rejected' };

const toForm = (m) => ({
  firstName: m.firstName || '',
  lastName: m.lastName || '',
  phoneNumber: m.phoneNumber || '',
  address: m.address || '',
  fitnessGoal: m.fitnessGoal || 'General Fitness',
  heightCm: m.heightCm || '',
  gender: m.gender || 'Prefer not to say',
  emergencyContact: m.emergencyContact || '',
  birthdate: m.birthdate ? String(m.birthdate).slice(0, 10) : '',
});

export default function MemberProfile() {
  usePageTitle('Profile', 'Manage your account and personal information.');
  const toast = useToast();
  const { refresh } = useAuth();
  const me = useFetch('/members/me');
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  const [doc, setDoc] = useState(null);
  const [school, setSchool] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmQr, setConfirmQr] = useState(false);
  const [qrKey, setQrKey] = useState(0);

  useEffect(() => {
    if (me.data?.member) {
      setF(toForm(me.data.member));
      setSchool(me.data.member.student?.school || '');
    }
  }, [me.data]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.patch('/members/me', { ...f, heightCm: f.heightCm ? Number(f.heightCm) : undefined, birthdate: f.birthdate || undefined });
      me.setData((d) => ({ ...d, member: data }));
      toast('Profile saved');
      refresh();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const avatar = async (file) => {
    const fd = new FormData();
    fd.append('avatar', file);
    try {
      await api.patch('/auth/account', fd);
      toast('Photo updated');
      me.reload();
      refresh();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const uploadId = async (e) => {
    e.preventDefault();
    if (!doc) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('document', doc);
    if (school) fd.append('school', school);
    try {
      const { data } = await api.post('/members/me/student-id', fd);
      me.setData((d) => ({ ...d, member: data }));
      setDoc(null);
      toast('School ID submitted for review');
      refresh();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setUploading(false);
    }
  };

  const regen = async () => {
    try {
      await api.post('/members/me/qr/regenerate');
      setQrKey((k) => k + 1);
      setConfirmQr(false);
      toast('QR code reset.');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const m = me.data?.member;
  const student = m?.student || {};
  const sStatus = student.status || 'none';

  return (
    <DataState {...me} onRetry={me.reload}>
      {m && f && (
        <Grid cols={{ xs: 1, md: '1fr 2fr' }}>
          <Stack spacing={2}>
            <Section>
              <Stack alignItems="center" spacing={1}>
                <UserAvatar name={m.name} src={m.avatarUrl} size={72} />
                <Typography fontWeight={800}>{m.name}</Typography>
                <Typography variant="body2" color="text.secondary">{m.email}</Typography>
                <Stack direction="row" spacing={1}>
                  <StatusChip label={m.status} />
                  <StatusChip label={m.memberCode} color="grey" />
                </Stack>
                <Typography variant="caption" color="text.secondary">Member since {fdate(m.registrationDate)}</Typography>
                <Button component="label" size="small">
                  Change photo
                  <input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => e.target.files[0] && avatar(e.target.files[0])} />
                </Button>
              </Stack>
            </Section>

            <Section title="Your check-in QR">
              <Stack alignItems="center" spacing={1}>
                <Box sx={{ p: 1.5, bgcolor: '#fff', border: 1, borderColor: 'divider', borderRadius: 2 }}>
                  <LiveQr refreshKey={qrKey} />
                </Box>
                <Typography fontWeight={800}>{m.memberCode}</Typography>
                <Typography variant="caption" color="text.secondary" textAlign="center">This code changes every 30 seconds, so screenshots will not work. Scan it at the kiosk when you arrive and when you leave.</Typography>
                <Button size="small" onClick={() => setConfirmQr(true)}>Reset QR code</Button>
              </Stack>
            </Section>

            <Section title="Student verification">
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="body2">Status:</Typography>
                <StatusChip label={STUDENT_LABEL[sStatus] || sStatus} color={sStatus === 'none' ? 'grey' : undefined} />
              </Stack>
              {student.school && <Typography variant="body2" color="text.secondary">School: {student.school}</Typography>}
              {student.idDocumentUrl && (
                <Link variant="caption" href={fileUrl(student.idDocumentUrl)} target="_blank" rel="noreferrer">View uploaded ID</Link>
              )}
              {sStatus === 'rejected' && student.note && <Alert severity="warning" sx={{ mt: 1 }}>{student.note}</Alert>}
              {sStatus === 'pending' && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>Staff will review your ID soon. You'll get a notification.</Typography>}
              {['none', 'rejected'].includes(sStatus) && (
                <Stack component="form" spacing={1.5} onSubmit={uploadId} sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">Upload your school ID to unlock the student plan.</Typography>
                  <TextField label="School" value={school} onChange={(e) => setSchool(e.target.value)} />
                  <Button component="label" variant="outlined">
                    {doc ? doc.name : 'Choose school ID (photo or PDF)'}
                    <input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" onChange={(e) => setDoc(e.target.files[0] || null)} />
                  </Button>
                  <Button type="submit" variant="contained" disabled={!doc || uploading}>Submit for review</Button>
                </Stack>
              )}
            </Section>
          </Stack>

          <Stack spacing={2}>
            <Section title="Personal information">
              <Stack component="form" spacing={2} onSubmit={save}>
                <Grid cols={{ xs: 1, sm: 2 }}>
                  <TextField label="First name" value={f.firstName} onChange={set('firstName')} required />
                  <TextField label="Last name" value={f.lastName} onChange={set('lastName')} required />
                  <TextField label="Phone number" value={f.phoneNumber} onChange={set('phoneNumber')} />
                  <TextField label="Birthdate" type="date" value={f.birthdate} onChange={set('birthdate')} InputLabelProps={{ shrink: true }} />
                  <TextField select label="Gender" value={f.gender} onChange={set('gender')}>
                    {GENDERS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                  </TextField>
                  <TextField select label="Fitness goal" value={f.fitnessGoal} onChange={set('fitnessGoal')} helperText="Used for coach matching and nutrition tips">
                    {GOALS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                  </TextField>
                  <TextField label="Height (cm)" type="number" value={f.heightCm} onChange={set('heightCm')} inputProps={{ min: 100, max: 250 }} helperText="Needed for BMI" />
                  <TextField label="Emergency contact" value={f.emergencyContact} onChange={set('emergencyContact')} />
                </Grid>
                <TextField label="Address" value={f.address} onChange={set('address')} />
                <TextField label="Email" value={m.email || ''} disabled helperText="Ask the front desk to change your email." />
                <Button type="submit" variant="contained" disabled={saving} sx={{ alignSelf: 'flex-start' }}>Save changes</Button>
              </Stack>
            </Section>
          </Stack>

          <ConfirmDialog
            open={confirmQr}
            title="Reset your QR code?"
            message="Any QR code already on a screen stops working right away. A new one appears here."
            confirmLabel="Reset QR code"
            onClose={() => setConfirmQr(false)}
            onConfirm={regen}
          />
        </Grid>
      )}
    </DataState>
  );
}
