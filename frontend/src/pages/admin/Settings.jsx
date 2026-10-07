import { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Stack, Switch, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import api, { API_URL, errMsg, fileUrl } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Grid, Section, StatusChip, ConfirmDialog, Empty } from '../../components/ui';
import { peso0, fdt } from '../../utils/format';
import { brand } from '../../theme';
import { NameField, PhoneField } from '../../components/ContactFields';

const GOALS = ['Any', 'Weight Loss', 'Muscle Gain', 'Strength', 'General Fitness', 'Endurance', 'Flexibility'];
const ROLE_LABEL = { admin: 'Administrator', receptionist: 'Staff' };
const splitList = (v) => v.split(',').map((x) => x.trim()).filter(Boolean);

function GymInfo({ gym, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setF({ name: gym.name || '', tagline: gym.tagline || '', about: gym.about || '', email: gym.email || '', phoneNumber: gym.phoneNumber || '', address: gym.address || '', city: gym.city || '', country: gym.country || '' }), [gym]);
  if (!f) return null;
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch('/settings', f);
      toast('Gym information saved');
      onSaved();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const logo = async (file) => {
    const fd = new FormData();
    fd.append('logo', file);
    try {
      await api.post('/settings/logo', fd);
      toast('Logo updated');
      onSaved();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };
  const removeLogo = async () => {
    try {
      await api.delete('/settings/logo');
      toast('Logo removed. Your gym name is shown instead.');
      onSaved();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Box component="form" onSubmit={save}>
      <Section title="Gym information" action={<Button type="submit" variant="contained" disabled={busy}>Save changes</Button>}>
        <Grid cols={{ xs: 1, sm: 2 }}>
          <TextField label="Gym name" value={f.name} onChange={set('name')} required />
          <TextField label="Tagline" value={f.tagline} onChange={set('tagline')} />
          <TextField label="Email" type="email" value={f.email} onChange={set('email')} />
          <PhoneField label="Phone number" value={f.phoneNumber} onChange={set('phoneNumber')} />
          <TextField label="Address" value={f.address} onChange={set('address')} />
          <TextField label="City" value={f.city} onChange={set('city')} />
          <TextField label="Country" value={f.country} onChange={set('country')} />
        </Grid>
        <TextField sx={{ mt: 2 }} label="About (shown on your public page)" value={f.about} onChange={set('about')} multiline minRows={3} />
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
          {gym.logoUrl ? <Box component="img" src={fileUrl(gym.logoUrl)} alt="Gym logo" sx={{ height: 48, borderRadius: 1, border: `1px solid ${brand.line}` }} /> : <Typography variant="body2" color="text.secondary">No logo yet: your gym name is shown instead</Typography>}
          <Button component="label" variant="outlined">{gym.logoUrl ? 'Change logo' : 'Upload logo'}<input hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => { const file = e.target.files[0]; e.target.value = ''; if (file) logo(file); }} /></Button>
          {gym.logoUrl && <Button color="error" onClick={removeLogo}>Remove logo</Button>}
          <Typography variant="caption" color="text.secondary">Public page: {window.location.origin}/g/{gym.slug}</Typography>
        </Stack>
      </Section>
    </Box>
  );
}

function Operations({ gym, onSaved }) {
  const toast = useToast();
  const [s, setS] = useState(null);
  const [lists, setLists] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const g = gym.settings || {};
    setS({ openTime: g.openTime || '06:00', closeTime: g.closeTime || '22:00', walkInFee: g.walkInFee ?? 0, graceDays: g.graceDays ?? 0, nearExpiryDays: g.nearExpiryDays ?? 7, inactiveDays: g.inactiveDays ?? 14, allowOnlineSignup: !!g.allowOnlineSignup, emailNotifications: !!g.emailNotifications, discounts: (g.discounts || []).map((d) => ({ label: d.label, percent: Math.round((d.rate || 0) * 100) })) });
    setLists({ programCategories: (g.programCategories || []).join(', '), specializations: (g.specializations || []).join(', ') });
  }, [gym]);
  if (!s) return null;
  const up = (k, v) => setS({ ...s, [k]: v });
  const setDisc = (i, k, v) => up('discounts', s.discounts.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const settings = {
        openTime: s.openTime, closeTime: s.closeTime, walkInFee: Number(s.walkInFee), graceDays: Number(s.graceDays), nearExpiryDays: Number(s.nearExpiryDays), inactiveDays: Number(s.inactiveDays),
        allowOnlineSignup: s.allowOnlineSignup, emailNotifications: s.emailNotifications,
        discounts: s.discounts.filter((d) => d.label.trim() && Number(d.percent) > 0).map((d) => ({ label: d.label.trim(), rate: Math.min(Number(d.percent), 100) / 100 })),
        programCategories: splitList(lists.programCategories), specializations: splitList(lists.specializations),
      };
      await api.patch('/settings', { settings });
      toast('Operations saved');
      onSaved();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack component="form" spacing={2} onSubmit={save}>
      <Section title="Hours, fees and membership rules" action={<Button type="submit" variant="contained" disabled={busy}>Save changes</Button>}>
        <Grid cols={{ xs: 1, sm: 2, md: 3 }}>
          <TextField type="time" label="Opening time" value={s.openTime} onChange={(e) => up('openTime', e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField type="time" label="Closing time" value={s.closeTime} onChange={(e) => up('closeTime', e.target.value)} InputLabelProps={{ shrink: true }} helperText="Open visits are auto checked out at closing" />
          <TextField type="number" label="Walk-in day pass (₱)" value={s.walkInFee} onChange={(e) => up('walkInFee', e.target.value)} inputProps={{ min: 0 }} />
          <TextField type="number" label="Grace period after expiry (days)" value={s.graceDays} onChange={(e) => up('graceDays', e.target.value)} inputProps={{ min: 0, max: 30 }} helperText="Members can still check in, with a reminder" />
          <TextField type="number" label="Near-expiry warning (days)" value={s.nearExpiryDays} onChange={(e) => up('nearExpiryDays', e.target.value)} inputProps={{ min: 1, max: 60 }} />
          <TextField type="number" label="Inactive after (days without a visit)" value={s.inactiveDays} onChange={(e) => up('inactiveDays', e.target.value)} inputProps={{ min: 1, max: 365 }} />
        </Grid>
        <Stack sx={{ mt: 1 }}>
          <FormControlLabel control={<Switch checked={s.allowOnlineSignup} onChange={(e) => up('allowOnlineSignup', e.target.checked)} />} label="Allow online member registration" />
          <FormControlLabel control={<Switch checked={s.emailNotifications} onChange={(e) => up('emailNotifications', e.target.checked)} />} label="Send email notifications (renewal reminders, receipts, alerts)" />
        </Stack>
      </Section>
      <Grid cols={{ xs: 1, md: 2 }}>
        <Section title="POS discounts" action={<Button size="small" variant="outlined" onClick={() => up('discounts', [...s.discounts, { label: '', percent: 10 }])}>+ Add discount</Button>}>
          <Stack spacing={1.5}>
            {s.discounts.map((d, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center">
                <TextField label="Label" value={d.label} onChange={(e) => setDisc(i, 'label', e.target.value)} />
                <TextField label="%" type="number" value={d.percent} onChange={(e) => setDisc(i, 'percent', e.target.value)} inputProps={{ min: 1, max: 100 }} sx={{ width: 100, flex: 'none' }} />
                <IconButton size="small" aria-label="Remove discount" onClick={() => up('discounts', s.discounts.filter((_, j) => j !== i))}><DeleteOutline fontSize="small" /></IconButton>
              </Stack>
            ))}
            {!s.discounts.length && <Empty>No discounts set.</Empty>}
          </Stack>
        </Section>
        <Section title="Lists">
          <Stack spacing={2}>
            <TextField label="Program categories (comma separated)" value={lists.programCategories} onChange={(e) => setLists({ ...lists, programCategories: e.target.value })} multiline />
            <TextField label="Coach specializations (comma separated)" value={lists.specializations} onChange={(e) => setLists({ ...lists, specializations: e.target.value })} multiline helperText="Used for rule-based coach matching" />
          </Stack>
        </Section>
      </Grid>
    </Stack>
  );
}

function Plans() {
  const toast = useToast();
  const p = useFetch('/plans', { initial: [] });
  const [edit, setEdit] = useState(undefined);
  const [f, setF] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const open = (x) => {
    setF(x ? { planName: x.planName, description: x.description || '', price: x.price, duration: x.duration, isStudentPlan: !!x.isStudentPlan, highlight: !!x.highlight, status: x.status, sortOrder: x.sortOrder || 0 } : { planName: '', description: '', price: '', duration: 30, isStudentPlan: false, highlight: false, status: 'Active', sortOrder: 0 });
    setEdit(x || null);
  };
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const body = { ...f, price: Number(f.price), duration: Number(f.duration), sortOrder: Number(f.sortOrder) || 0 };
    try {
      if (edit) await api.patch(`/plans/${edit._id}`, body);
      else await api.post('/plans', body);
      toast('Plan saved');
      setEdit(undefined);
      p.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      await api.delete(`/plans/${del._id}`);
      toast('Plan deleted');
      p.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
    setDel(null);
  };
  return (
    <Section title="Membership plans" action={<Button variant="contained" onClick={() => open(null)}>+ Add plan</Button>}>
      <DataState {...p} onRetry={p.reload}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>Plan</TableCell><TableCell align="right">Price</TableCell><TableCell align="right">Duration</TableCell><TableCell>Type</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {(p.data || []).map((x) => (
                <TableRow key={x._id}>
                  <TableCell><b>{x.planName}</b><Typography variant="caption" display="block" color="text.secondary">{x.description}</Typography></TableCell>
                  <TableCell align="right">{peso0(x.price)}</TableCell>
                  <TableCell align="right">{x.duration} days</TableCell>
                  <TableCell><Stack direction="row" spacing={0.5}>{x.isStudentPlan && <StatusChip label="Student" color="blue" />}{x.highlight && <StatusChip label="Highlighted" color="amber" />}{!x.isStudentPlan && !x.highlight && 'Regular'}</Stack></TableCell>
                  <TableCell><StatusChip label={x.status} /></TableCell>
                  <TableCell><Stack direction="row" spacing={1}><Button size="small" variant="outlined" onClick={() => open(x)}>Edit</Button><IconButton size="small" onClick={() => setDel(x)} aria-label="Delete plan"><DeleteOutline fontSize="small" /></IconButton></Stack></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!p.data?.length && <Empty>No plans yet.</Empty>}
        </Box>
      </DataState>
      <Dialog open={edit !== undefined} onClose={() => setEdit(undefined)} maxWidth="xs" fullWidth PaperProps={{ component: 'form', onSubmit: save }}>
        <DialogTitle>{edit ? 'Edit plan' : 'Add plan'}</DialogTitle>
        <DialogContent>
          {f && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Plan name" value={f.planName} onChange={(e) => setF({ ...f, planName: e.target.value })} required />
              <TextField label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} multiline />
              <Grid cols={{ xs: 2 }}>
                <TextField label="Price (₱)" type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} required inputProps={{ min: 0 }} />
                <TextField label="Duration (days)" type="number" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} required inputProps={{ min: 1 }} />
                <TextField label="Display order" type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} />
                <TextField select label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><MenuItem value="Active">Active</MenuItem><MenuItem value="Inactive">Inactive</MenuItem></TextField>
              </Grid>
              <FormControlLabel control={<Checkbox checked={f.isStudentPlan} onChange={(e) => setF({ ...f, isStudentPlan: e.target.checked })} />} label="Student plan (needs a verified school ID)" />
              <FormControlLabel control={<Checkbox checked={f.highlight} onChange={(e) => setF({ ...f, highlight: e.target.checked })} />} label="Highlight as most popular" />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={() => setEdit(undefined)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy}>Save plan</Button></DialogActions>
      </Dialog>
      <ConfirmDialog open={!!del} title={`Delete ${del?.planName}?`} message="Plans that members are on can't be deleted. Set them to Inactive instead." confirmLabel="Delete" danger onClose={() => setDel(null)} onConfirm={remove} />
    </Section>
  );
}

function Nutrition() {
  const toast = useToast();
  const r = useFetch('/engagement/nutrition-rules', { initial: [] });
  const [edit, setEdit] = useState(undefined);
  const [f, setF] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const open = (x) => {
    setF(x ? { goal: x.goal, bmiMin: x.bmiMin, bmiMax: x.bmiMax, title: x.title || '', tips: (x.tips || []).join('\n'), status: x.status } : { goal: 'Weight Loss', bmiMin: 0, bmiMax: 100, title: '', tips: '', status: 'Active' });
    setEdit(x || null);
  };
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const body = { ...f, bmiMin: Number(f.bmiMin), bmiMax: Number(f.bmiMax), tips: f.tips.split('\n').map((t) => t.trim()).filter(Boolean) };
    try {
      if (edit) await api.patch(`/engagement/nutrition-rules/${edit._id}`, body);
      else await api.post('/engagement/nutrition-rules', body);
      toast('Rule saved');
      setEdit(undefined);
      r.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      await api.delete(`/engagement/nutrition-rules/${del._id}`);
      toast('Rule deleted');
      r.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
    setDel(null);
  };
  return (
    <Section title="Nutrition rules" action={<Button variant="contained" onClick={() => open(null)}>+ Add rule</Button>}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Rule-based tips: members see every active rule that matches their fitness goal (or "Any") and whose BMI range includes their latest BMI. General guidance only, not medical advice.</Typography>
      <DataState {...r} onRetry={r.reload}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>Goal</TableCell><TableCell>BMI range</TableCell><TableCell>Title</TableCell><TableCell>Tips</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {(r.data || []).map((x) => (
                <TableRow key={x._id}>
                  <TableCell>{x.goal}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{x.bmiMin}–{x.bmiMax}</TableCell>
                  <TableCell><b>{x.title}</b></TableCell>
                  <TableCell sx={{ color: 'text.secondary', maxWidth: 360 }}>{(x.tips || []).join(' · ')}</TableCell>
                  <TableCell><StatusChip label={x.status} /></TableCell>
                  <TableCell><Stack direction="row" spacing={1}><Button size="small" variant="outlined" onClick={() => open(x)}>Edit</Button><IconButton size="small" onClick={() => setDel(x)} aria-label="Delete rule"><DeleteOutline fontSize="small" /></IconButton></Stack></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!r.data?.length && <Empty>No nutrition rules yet. Built-in tips are shown until you add some.</Empty>}
        </Box>
      </DataState>
      <Dialog open={edit !== undefined} onClose={() => setEdit(undefined)} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: save }}>
        <DialogTitle>{edit ? 'Edit rule' : 'Add rule'}</DialogTitle>
        <DialogContent>
          {f && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Grid cols={{ xs: 1, sm: 3 }}>
                <TextField select label="Goal" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })}>{GOALS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}</TextField>
                <TextField label="BMI from" type="number" value={f.bmiMin} onChange={(e) => setF({ ...f, bmiMin: e.target.value })} inputProps={{ step: 0.1, min: 0 }} />
                <TextField label="BMI below" type="number" value={f.bmiMax} onChange={(e) => setF({ ...f, bmiMax: e.target.value })} inputProps={{ step: 0.1, min: 0 }} />
              </Grid>
              <TextField label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
              <TextField label="Tips (one per line)" value={f.tips} onChange={(e) => setF({ ...f, tips: e.target.value })} multiline minRows={4} required />
              <TextField select label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><MenuItem value="Active">Active</MenuItem><MenuItem value="Inactive">Inactive</MenuItem></TextField>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={() => setEdit(undefined)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy}>Save rule</Button></DialogActions>
      </Dialog>
      <ConfirmDialog open={!!del} title={`Delete "${del?.title}"?`} message="Members will no longer see these tips." confirmLabel="Delete" danger onClose={() => setDel(null)} onConfirm={remove} />
    </Section>
  );
}

function Staff() {
  const { account } = useAuth();
  const toast = useToast();
  const s = useFetch('/settings/staff', { initial: [] });
  const blank = { firstName: '', lastName: '', email: '', phoneNumber: '', role: 'receptionist' };
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const [temp, setTemp] = useState('');
  const [reset, setReset] = useState(null);
  const [resetTemp, setResetTemp] = useState(null);
  const [busy, setBusy] = useState(false);
  const me = (x) => String(x._id) === String(account?._id);
  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/settings/staff', f);
      if (data.temporaryPassword) setTemp(data.temporaryPassword);
      else setOpen(false);
      toast('Staff account created');
      s.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const update = async (x, body) => {
    try {
      await api.patch(`/settings/staff/${x._id}`, body);
      toast('Updated');
      s.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };
  const decide = async (x, action) => {
    try {
      await api.post(`/settings/staff/${x._id}/${action}`);
      toast(action === 'approve' ? `${x.name} can now log in` : 'Request rejected');
      s.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };
  const pending = (s.data || []).filter((x) => x.status === 'pending');
  const doReset = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/settings/staff/${reset._id}/reset-password`);
      setResetTemp({ name: reset.name, email: reset.email, password: data.temporaryPassword });
      setReset(null);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="Staff accounts" action={<Button variant="contained" onClick={() => { setOpen(true); setTemp(''); setF(blank); }}>+ Add staff</Button>}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Administrators can use every page. Staff accounts handle the front desk: members, attendance, billing, POS, inventory, equipment, incidents, support and community. Add coaches from the Coaches page.</Typography>
      {pending.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={800} sx={{ mb: 1 }}>{pending.length} staff account request{pending.length > 1 ? 's' : ''} waiting for approval</Typography>
          <Stack spacing={1}>
            {pending.map((x) => (
              <Stack key={x._id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="body2" sx={{ flex: 1, minWidth: 200 }}><b>{x.name}</b> · {x.email} · {x.phoneNumber}</Typography>
                <Button size="small" variant="contained" onClick={() => decide(x, 'approve')}>Approve</Button>
                <Button size="small" color="error" onClick={() => decide(x, 'reject')}>Reject</Button>
              </Stack>
            ))}
          </Stack>
        </Alert>
      )}
      <DataState {...s} onRetry={s.reload}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Role</TableCell><TableCell>Last login</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {(s.data || []).filter((x) => x.status !== 'pending').map((x) => (
                <TableRow key={x._id}>
                  <TableCell><b>{x.name}</b>{me(x) && ' (you)'}<Typography variant="caption" display="block" color="text.secondary">{x.phoneNumber}</Typography></TableCell>
                  <TableCell>{x.email}</TableCell>
                  <TableCell>
                    <TextField select size="small" value={x.role} onChange={(e) => update(x, { role: e.target.value })} disabled={me(x)} inputProps={{ 'aria-label': 'Role' }} sx={{ minWidth: 150 }}>
                      <MenuItem value="admin">{ROLE_LABEL.admin}</MenuItem>
                      <MenuItem value="receptionist">{ROLE_LABEL.receptionist}</MenuItem>
                    </TextField>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{fdt(x.lastLoginAt)}</TableCell>
                  <TableCell><StatusChip label={x.status === 'active' ? 'Active' : 'Inactive'} /></TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      {!me(x) && <Button size="small" variant="outlined" onClick={() => update(x, { status: x.status === 'active' ? 'inactive' : 'active' })}>{x.status === 'active' ? 'Deactivate' : 'Reactivate'}</Button>}
                      {!me(x) && <Button size="small" onClick={() => setReset(x)} sx={{ whiteSpace: 'nowrap' }}>Reset password</Button>}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </DataState>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth PaperProps={{ component: 'form', onSubmit: add }}>
        <DialogTitle>Add staff account</DialogTitle>
        <DialogContent>
          {temp ? (
            <Alert severity="success" sx={{ mt: 1 }}>Account created. Login: <b>{f.email}</b>, temporary password <b>{temp}</b>. Share it privately.</Alert>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <NameField label="First name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} required />
              <NameField label="Last name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} required />
              <TextField label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
              <PhoneField label="Phone number" value={f.phoneNumber} onChange={(e) => setF({ ...f, phoneNumber: e.target.value })} />
              <TextField select label="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                <MenuItem value="receptionist">{ROLE_LABEL.receptionist}</MenuItem>
                <MenuItem value="admin">{ROLE_LABEL.admin}</MenuItem>
              </TextField>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setOpen(false)}>{temp ? 'Done' : 'Cancel'}</Button>
          {!temp && <Button type="submit" variant="contained" disabled={busy}>Create account</Button>}
        </DialogActions>
      </Dialog>
      <ConfirmDialog open={!!reset} title={`Reset password for ${reset?.name}?`} message="A new temporary password will be created. The old password stops working right away." confirmLabel="Reset password" busy={busy} onClose={() => setReset(null)} onConfirm={doReset} />
      <Dialog open={!!resetTemp} onClose={() => setResetTemp(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Password reset</DialogTitle>
        <DialogContent><Alert severity="success">{resetTemp?.name} can now log in with <b>{resetTemp?.email}</b> and temporary password <b>{resetTemp?.password}</b>.</Alert></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="contained" onClick={() => setResetTemp(null)}>Done</Button></DialogActions>
      </Dialog>
    </Section>
  );
}

const PM_METHODS = [['card', 'Credit / debit card'], ['gcash', 'GCash'], ['paymaya', 'Maya'], ['grab_pay', 'GrabPay'], ['qrph', 'QR Ph']];

function OnlinePayments({ gym, onSaved }) {
  const toast = useToast();
  const pm = gym.paymongo || {};
  const [key, setKey] = useState('');
  const [methods, setMethods] = useState(pm.methods?.length ? pm.methods : ['card', 'gcash', 'paymaya']);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setMethods(gym.paymongo?.methods?.length ? gym.paymongo.methods : ['card', 'gcash', 'paymaya']), [gym]);
  const save = async (extra = {}) => {
    setBusy(true);
    try {
      await api.put('/settings/paymongo', { secretKey: key || undefined, methods, ...extra });
      toast(extra.enabled === true ? 'Online payments turned on' : extra.enabled === false ? 'Online payments turned off' : 'Online payment settings saved');
      setKey('');
      onSaved();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      await api.delete('/settings/paymongo');
      toast('PayMongo keys removed');
      setConfirm(false);
      onSaved();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };
  const toggle = (m) => setMethods((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]));
  return (
    <Stack spacing={2}>
      <Section title="Online payments (PayMongo)" action={pm.last4 ? <StatusChip label={pm.enabled ? 'On' : 'Off'} color={pm.enabled ? 'green' : 'grey'} /> : null}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Members can pay renewals, unpaid invoices and online sign-ups by card, GCash or Maya. This is an extra option: GCash reference and paying at the front desk still work. Money goes straight to your gym's PayMongo account, and memberships activate automatically once PayMongo confirms the payment.
        </Typography>
        {pm.last4 ? (
          <Alert severity={pm.mode === 'live' ? 'success' : 'info'} sx={{ mb: 2 }}>
            Connected with a <b>{pm.mode === 'live' ? 'LIVE' : 'TEST'}</b> secret key ending in <b>{pm.last4}</b>.{pm.mode === 'test' ? ' Test mode: no real money moves. Use PayMongo test cards to try it, then switch to your live key.' : ''}
          </Alert>
        ) : (
          <Alert severity="warning" sx={{ mb: 2 }}>Not connected yet. Add your PayMongo secret key below.</Alert>
        )}
        <Stack spacing={2}>
          <TextField
            label={pm.last4 ? 'Replace secret key (optional)' : 'PayMongo secret key'}
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value.trim())}
            placeholder="sk_test_… or sk_live_…"
            helperText="PayMongo Dashboard → Developers → API Keys. Use the SECRET key. It is stored encrypted and is never shown again."
            autoComplete="off"
          />
          <Box>
            <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>Methods members can use</Typography>
            <Stack direction="row" flexWrap="wrap" useFlexGap>
              {PM_METHODS.map(([v, l]) => <FormControlLabel key={v} control={<Checkbox checked={methods.includes(v)} onChange={() => toggle(v)} />} label={l} />)}
            </Stack>
            <Typography variant="caption" color="text.secondary">Only tick methods that are activated in your PayMongo account.</Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained" disabled={busy || (!key && !pm.last4)} onClick={() => save()}>{busy ? 'Checking key…' : 'Save'}</Button>
            {pm.last4 && (pm.enabled
              ? <Button variant="outlined" color="error" disabled={busy} onClick={() => save({ enabled: false })}>Turn off online payments</Button>
              : <Button variant="outlined" disabled={busy} onClick={() => save({ enabled: true })}>Turn on online payments</Button>)}
            {pm.last4 && <Button color="error" onClick={() => setConfirm(true)}>Remove keys</Button>}
          </Stack>
        </Stack>
      </Section>
      <Section title="Faster confirmation (optional)">
        <Typography variant="body2" color="text.secondary">GYMORA checks pending online payments every few minutes and right after the member returns from PayMongo. For instant confirmation, add this webhook in PayMongo → Developers → Webhooks with the event <b>checkout_session.payment.paid</b>:</Typography>
        <Box sx={{ mt: 1, p: 1.2, bgcolor: brand.fill, borderRadius: 2, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>{`${API_URL}/api/online-payments/webhook/${gym._id}`}</Box>
      </Section>
      <ConfirmDialog open={confirm} title="Remove PayMongo keys?" message="Online payments turn off. Members can still pay with GCash reference or at the front desk." confirmLabel="Remove" danger onClose={() => setConfirm(false)} onConfirm={remove} />
    </Stack>
  );
}

function KioskAndJobs({ gym, onSaved }) {
  const toast = useToast();
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const regen = async () => {
    setBusy(true);
    try {
      await api.post('/settings/kiosk-key');
      toast('New kiosk key created. Unlock the kiosk again with it.');
      setConfirm(false);
      onSaved();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const run = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/settings/run-daily-jobs');
      setResult(data);
      toast('Scheduled jobs finished');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const url = `${window.location.origin}/kiosk/${gym.slug}`;
  const st = gym.settings || {};
  return (
    <Grid cols={{ xs: 1, md: 2 }}>
      <Section title="QR check-in kiosk">
        <Typography variant="body2" sx={{ mb: 1 }}>Open this page on a tablet at the entrance:</Typography>
        <Typography sx={{ bgcolor: brand.fill, p: 1, borderRadius: 1, fontFamily: 'monospace', wordBreak: 'break-all' }}>{url}</Typography>
        <Typography variant="body2" sx={{ mt: 2 }}>Kiosk key (staff enter it once on the tablet):</Typography>
        <Typography sx={{ fontSize: 28, fontWeight: 800, letterSpacing: 4, fontFamily: 'monospace' }}>{st.kioskKey || '—'}</Typography>
        <Button variant="outlined" onClick={() => setConfirm(true)} sx={{ mt: 1 }}>Generate new key</Button>
      </Section>
      <Section title="Scheduled jobs">
        <Typography variant="body2" color="text.secondary">These run automatically every night:</Typography>
        <Box component="ul" sx={{ pl: 2.5, my: 1, '& li': { fontSize: 14, mb: 0.5 } }}>
          <li>Renewal reminders for memberships ending within {st.nearExpiryDays} days</li>
          <li>"We miss you" alerts after {st.inactiveDays} days without a visit</li>
          <li>Low-stock and equipment-service alerts to staff</li>
          <li>Auto check-out for visits left open from previous days</li>
        </Box>
        <Button variant="contained" onClick={run} disabled={busy}>{busy ? 'Running…' : 'Run now'}</Button>
        {result && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {result.renewalReminders} renewal reminders · {result.inactivityAlerts} inactivity alerts · {result.lowStockItems} low-stock items · {result.equipmentDue} equipment due · {result.autoCheckedOut} visits auto checked out
          </Alert>
        )}
      </Section>
      <ConfirmDialog open={confirm} title="Generate a new kiosk key?" message="The current key stops working. The kiosk tablet must be unlocked again with the new key." confirmLabel="Generate" busy={busy} onClose={() => setConfirm(false)} onConfirm={regen} />
    </Grid>
  );
}

export default function Settings() {
  usePageTitle('System Settings', 'Manage your gym configuration and preferences.');
  const { refresh } = useAuth();
  const g = useFetch('/settings');
  const [tab, setTab] = useState(0);
  const saved = () => {
    g.reload();
    if (refresh) refresh();
  };
  return (
    <Stack spacing={2}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
        <Tab label="Gym info" />
        <Tab label="Operations" />
        <Tab label="Membership plans" />
        <Tab label="Nutrition rules" />
        <Tab label="Staff accounts" />
        <Tab label="Kiosk & jobs" />
        <Tab label="Online payments" />
      </Tabs>
      {tab === 2 && <Plans />}
      {tab === 3 && <Nutrition />}
      {tab === 4 && <Staff />}
      {[0, 1, 5, 6].includes(tab) && (
        <DataState {...g} onRetry={g.reload}>
          {g.data && (
            <>
              {tab === 0 && <GymInfo gym={g.data} onSaved={saved} />}
              {tab === 1 && <Operations gym={g.data} onSaved={saved} />}
              {tab === 5 && <KioskAndJobs gym={g.data} onSaved={saved} />}
              {tab === 6 && <OnlinePayments gym={g.data} onSaved={saved} />}
            </>
          )}
        </DataState>
      )}
    </Stack>
  );
}
