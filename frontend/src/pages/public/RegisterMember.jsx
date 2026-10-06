import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Button, Checkbox, FormControlLabel, Link, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AuthLayout from '../auth/AuthLayout';
import useFetch from '../../hooks/useFetch';
import api, { errMsg } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Grid, Loading } from '../../components/ui';
import { peso0 } from '../../utils/format';
import { NameField, PhoneField } from '../../components/ContactFields';

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

export default function RegisterMember() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { acceptSession } = useAuth();
  const { data, error: loadError } = useFetch(`/public/gyms/${slug}`);
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phoneNumber: '', password: '', fitnessGoal: 'General Fitness', planId: params.get('plan') || '', gender: 'Prefer not to say', birthdate: '', heightCm: '', isStudent: false, school: '' });
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data && !f.planId) setF((x) => ({ ...x, planId: data.plans.find((p) => !p.isStudentPlan)?._id || data.plans[0]?._id || '' }));
  }, [data, f.planId]);

  const chosen = data?.plans.find((p) => p._id === f.planId);

  const submit = async (e) => {
    e.preventDefault();
    if (chosen?.isStudentPlan && !f.isStudent) {
      setError('The student plan is for students. Tick "I am a student" or choose another plan.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data: res } = await api.post(`/public/gyms/${slug}/register`, {
        ...f,
        email: f.email.trim(),
        heightCm: f.heightCm ? Number(f.heightCm) : undefined,
        birthdate: f.birthdate || undefined,
        school: f.isStudent ? f.school : undefined,
      });
      if (res?.token) {
        acceptSession(res);
        navigate('/member/payments', { replace: true });
      } else {
        setDone(res?.message || 'Registration received. Please visit the front desk to complete your membership.');
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <AuthLayout gym={data?.gym} line1="Your journey" accent="starts here." sub={`Create your member account at ${data?.gym.name || 'your gym'} and take the first step towards a stronger, healthier you.`} wide>
      <Stack direction="row" justifyContent="space-between">
        <Link component={RouterLink} to={`/g/${slug}`} underline="hover" variant="body2">← Back</Link>
        <Link component={RouterLink} to={`/member/login?gym=${slug}`} underline="hover" variant="body2" fontWeight={700}>Member login</Link>
      </Stack>
      <Typography variant="h4" textAlign="center" sx={{ my: 2 }}>Create a member account</Typography>
      {loadError ? <Alert severity="error">{loadError}</Alert> : !data ? <Loading /> : done ? (
        <Stack spacing={2}>
          <Alert severity="success">{done}</Alert>
          <Button variant="contained" component={RouterLink} to={`/member/login?gym=${slug}`}>Go to member login</Button>
        </Stack>
      ) : data.gym.settings?.allowOnlineSignup === false ? (
        <Alert severity="info">{data.gym.name} registers new members at the front desk. Visit the gym to sign up.</Alert>
      ) : !data.plans.length ? (
        <Alert severity="info">{data.gym.name} has no membership plans open for online sign-up yet. Please visit the front desk.</Alert>
      ) : (
        <Stack component="form" spacing={2} onSubmit={submit}>
          {error && <Alert severity="error">{error}</Alert>}
          <Grid cols={{ xs: 1, sm: 2 }}>
            <NameField label="First name" value={f.firstName} onChange={set('firstName')} required />
            <NameField label="Last name" value={f.lastName} onChange={set('lastName')} required />
            <TextField label="Email" type="email" value={f.email} onChange={set('email')} required autoComplete="email" />
            <PhoneField label="Phone number" value={f.phoneNumber} onChange={set('phoneNumber')} required />
            <TextField label="Password" type="password" value={f.password} onChange={set('password')} required inputProps={{ minLength: 8 }} helperText="At least 8 characters" autoComplete="new-password" />
            <TextField select label="Fitness goal" value={f.fitnessGoal} onChange={set('fitnessGoal')}>{(data.goals || []).map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}</TextField>
            <TextField select label="Gender" value={f.gender} onChange={set('gender')}>{GENDERS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}</TextField>
            <TextField label="Birthdate" type="date" value={f.birthdate} onChange={set('birthdate')} InputLabelProps={{ shrink: true }} />
            <TextField label="Height (cm)" type="number" value={f.heightCm} onChange={set('heightCm')} inputProps={{ min: 100, max: 250 }} helperText="Used for BMI and nutrition tips" />
          </Grid>
          <TextField select label="Membership plan" value={f.planId} onChange={set('planId')} required>
            {data.plans.map((p) => <MenuItem key={p._id} value={p._id} disabled={p.isStudentPlan && !f.isStudent}>{p.planName} · {peso0(p.price)} / {p.duration} days{p.isStudentPlan ? ' (students)' : ''}</MenuItem>)}
          </TextField>
          <FormControlLabel control={<Checkbox checked={f.isStudent} onChange={(e) => setF({ ...f, isStudent: e.target.checked })} />} label="I am a student (upload your school ID after signing up)" />
          {f.isStudent && <TextField label="School" value={f.school} onChange={set('school')} />}
          <FormControlLabel control={<Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)} required />} label="I agree to the gym rules and the privacy policy" />
          <Button type="submit" size="large" variant="contained" disabled={busy || !agree}>Create account</Button>
          <Typography variant="caption" color="text.secondary">Your plan starts once payment is recorded at the front desk or your GCash payment is verified.</Typography>
        </Stack>
      )}
    </AuthLayout>
  );
}
