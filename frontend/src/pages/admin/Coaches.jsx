import { useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../context/SocketContext';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Grid, Section, StatCard, StatusChip, UserAvatar, ConfirmDialog, Empty } from '../../components/ui';
import { NameField, PhoneField } from '../../components/ContactFields';

const blank = { firstName: '', lastName: '', email: '', phoneNumber: '', certification: '', experience: 0, bio: '', specializations: [], activeStatus: 'Active' };

function CoachDialog({ open, coach, onClose, onSaved }) {
  const { gym } = useAuth();
  const toast = useToast();
  const [f, setF] = useState(null);
  const [temp, setTemp] = useState('');
  const [busy, setBusy] = useState(false);
  const specs = [...new Set([...(gym?.settings?.specializations || []), ...(f?.specializations || [])])];
  const init = () => {
    setTemp('');
    setF(coach
      ? { firstName: coach.firstName, lastName: coach.lastName, email: coach.email, phoneNumber: coach.phoneNumber || '', certification: coach.certification || '', experience: coach.experience || 0, bio: coach.bio || '', specializations: coach.specializations || [], activeStatus: coach.activeStatus || 'Active' }
      : { ...blank });
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...f, experience: Number(f.experience) || 0 };
      if (coach) {
        await api.patch(`/coaches/${coach._id}`, body);
        toast('Coach updated');
        onClose();
      } else {
        delete body.activeStatus;
        const { data } = await api.post('/coaches', body);
        setTemp(data.temporaryPassword || '');
        if (!data.temporaryPassword) onClose();
        toast('Coach added');
      }
      onSaved();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth TransitionProps={{ onEnter: init }} PaperProps={{ component: 'form', onSubmit: submit }}>
      <DialogTitle>{coach ? 'Edit coach' : 'Add coach'}</DialogTitle>
      <DialogContent>
        {temp ? (
          <Alert severity="success" sx={{ mt: 1 }}>Coach account created. They log in with <b>{f.email}</b> and temporary password <b>{temp}</b>. Share it privately.</Alert>
        ) : f && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Grid cols={{ xs: 1, sm: 2 }}>
              <NameField label="First name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} required />
              <NameField label="Last name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} required />
              <TextField label="Email (login)" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
              <PhoneField label="Phone number" value={f.phoneNumber} onChange={(e) => setF({ ...f, phoneNumber: e.target.value })} />
              <TextField label="Certification" value={f.certification} onChange={(e) => setF({ ...f, certification: e.target.value })} />
              <TextField label="Years of experience" type="number" value={f.experience} onChange={(e) => setF({ ...f, experience: e.target.value })} inputProps={{ min: 0 }} />
            </Grid>
            <TextField label="Bio" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} multiline minRows={2} />
            <Typography variant="body2" fontWeight={700}>Specializations</Typography>
            <Grid cols={{ xs: 1, sm: 3 }} gap={0}>
              {specs.map((s) => (
                <FormControlLabel key={s} label={s} control={<Checkbox size="small" checked={f.specializations.includes(s)} onChange={(e) => setF({ ...f, specializations: e.target.checked ? [...f.specializations, s] : f.specializations.filter((x) => x !== s) })} />} />
              ))}
            </Grid>
            {coach && (
              <TextField select label="Account status" value={f.activeStatus} onChange={(e) => setF({ ...f, activeStatus: e.target.value })} helperText="Inactive coaches cannot log in and are hidden from members.">
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
              </TextField>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onClose}>{temp ? 'Done' : 'Cancel'}</Button>
        {!temp && <Button type="submit" variant="contained" disabled={busy}>Save</Button>}
      </DialogActions>
    </Dialog>
  );
}

export default function Coaches() {
  usePageTitle('Coaches', 'Manage coaches, specializations and live availability.');
  const toast = useToast();
  const c = useFetch('/coaches', { initial: [] });
  const [edit, setEdit] = useState(undefined);
  const [reset, setReset] = useState(null);
  const [temp, setTemp] = useState(null);
  const [busy, setBusy] = useState(false);
  useSocketEvent('coach:availability', c.reload);
  const all = c.data || [];
  const pending = all.filter((x) => x.status === 'pending');
  const list = all.filter((x) => x.status !== 'pending');
  const decide = async (coach, action) => {
    try {
      await api.post(`/coaches/${coach._id}/${action}`);
      toast(action === 'approve' ? `${coach.name} can now log in` : 'Request rejected');
      c.reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };
  const active = list.filter((x) => x.activeStatus === 'Active');
  const count = (s) => active.filter((x) => x.availabilityStatus === s).length;
  const setAvail = async (coach, v) => {
    try {
      await api.patch(`/coaches/${coach._id}`, { availabilityStatus: v });
      toast(`${coach.name}: ${v}`);
      c.reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };
  const doReset = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/coaches/${reset._id}/reset-password`);
      setTemp({ name: reset.name, email: reset.email, password: data.temporaryPassword });
      setReset(null);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack spacing={2}>
      <Grid cols={{ xs: 1, sm: 2, lg: 4 }}>
        <StatCard label="Total coaches" value={list.length} sub={`${list.length - active.length} inactive`} />
        <StatCard label="Available now" value={count('Available')} />
        <StatCard label="In session" value={count('In Session')} />
        <StatCard label="Unavailable" value={count('Unavailable')} />
      </Grid>
      {pending.length > 0 && (
        <Section title={`Coach account requests (${pending.length})`}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>These coaches signed up on your gym's login page. They can log in after you approve them.</Typography>
          <Stack spacing={1.5}>
            {pending.map((x) => (
              <Stack key={x._id} direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={800}>{x.name}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">{x.email}{x.phoneNumber ? ` · ${x.phoneNumber}` : ''} · {x.experience || 0} yrs{x.certification ? ` · ${x.certification}` : ''}</Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>{x.specializations.map((s) => <Chip key={s} size="small" label={s} />)}</Stack>
                  {x.bio && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>{x.bio}</Typography>}
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="contained" onClick={() => decide(x, 'approve')}>Approve</Button>
                  <Button size="small" color="error" onClick={() => decide(x, 'reject')}>Reject</Button>
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Section>
      )}
      <Section title="Coach directory" action={<Button variant="contained" onClick={() => setEdit(null)}>+ Add coach</Button>}>
        <DataState {...c} onRetry={c.reload}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>Coach</TableCell><TableCell>Specializations</TableCell><TableCell>Experience</TableCell><TableCell align="right">Programs</TableCell><TableCell align="right">Clients</TableCell><TableCell align="right">Sessions this week</TableCell><TableCell>Availability</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {list.map((x) => (
                  <TableRow key={x._id} sx={{ opacity: x.activeStatus === 'Active' ? 1 : 0.55 }}>
                    <TableCell><Stack direction="row" spacing={1} alignItems="center"><UserAvatar name={x.name} src={x.avatarUrl} /><Box><Typography variant="body2" fontWeight={700}>{x.name}</Typography><Typography variant="caption" color="text.secondary">{x.email}{x.phoneNumber ? ` · ${x.phoneNumber}` : ''}</Typography></Box></Stack></TableCell>
                    <TableCell><Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>{x.specializations.map((s) => <Chip key={s} size="small" label={s} />)}</Stack></TableCell>
                    <TableCell>{x.experience || 0} yrs{x.certification ? ` · ${x.certification}` : ''}</TableCell>
                    <TableCell align="right">{x.programCount ?? 0}</TableCell>
                    <TableCell align="right">{x.clientCount ?? 0}</TableCell>
                    <TableCell align="right">{x.sessionsThisWeek ?? 0}</TableCell>
                    <TableCell>
                      <Select size="small" value={x.availabilityStatus || 'Unavailable'} onChange={(e) => setAvail(x, e.target.value)} inputProps={{ 'aria-label': `Availability of ${x.name}` }}>
                        {['Available', 'In Session', 'Unavailable'].map((s) => <MenuItem key={s} value={s}><StatusChip label={s} /></MenuItem>)}
                      </Select>
                    </TableCell>
                    <TableCell><StatusChip label={x.activeStatus} /></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="outlined" onClick={() => setEdit(x)}>Edit</Button>
                        <Button size="small" onClick={() => setReset(x)} sx={{ whiteSpace: 'nowrap' }}>Reset password</Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!list.length && <Empty>No coaches yet.</Empty>}
          </Box>
        </DataState>
      </Section>
      <CoachDialog open={edit !== undefined} coach={edit} onClose={() => setEdit(undefined)} onSaved={c.reload} />
      <ConfirmDialog open={!!reset} title={`Reset password for ${reset?.name}?`} message="A new temporary password will be created. The old password stops working right away." confirmLabel="Reset password" busy={busy} onClose={() => setReset(null)} onConfirm={doReset} />
      <Dialog open={!!temp} onClose={() => setTemp(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Password reset</DialogTitle>
        <DialogContent><Alert severity="success">{temp?.name} can now log in with <b>{temp?.email}</b> and temporary password <b>{temp?.password}</b>.</Alert></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="contained" onClick={() => setTemp(null)}>Done</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
