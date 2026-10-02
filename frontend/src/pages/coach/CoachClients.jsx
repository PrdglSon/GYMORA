import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Grid, Section, StatCard, StatusChip, UserAvatar, Empty } from '../../components/ui';
import { fdate } from '../../utils/format';

export default function CoachClients() {
  usePageTitle('My Clients', 'View and manage all clients assigned to you.');
  const navigate = useNavigate();
  const toast = useToast();
  const { gym, account } = useAuth();
  const c = useFetch('/coaches/me/clients', { initial: [] });
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('All');
  const [nudge, setNudge] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const all = c.data || [];
  const rows = all.filter((m) => {
    const s = q.toLowerCase();
    const hit = !s || m.name.toLowerCase().includes(s) || (m.memberCode || '').toLowerCase().includes(s);
    return hit && (filter === 'All' || m.activity === filter);
  });

  const openNudge = (m) => {
    setNudge(m);
    setMsg(`Coach ${account?.firstName || ''}: Hi ${m.firstName}, it's been a while. Your next session is waiting!`);
  };
  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/coaches/me/clients/${nudge._id}/nudge`, { message: msg });
      toast(`Reminder sent to ${nudge.name}`);
      setNudge(null);
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Grid cols={{ xs: 1, sm: 2, lg: 4 }}>
        <StatCard label="Total clients" value={all.length} sub={`${all.filter((x) => x.assignedToMe).length} chose you as coach`} />
        <StatCard label="Active clients" value={all.filter((x) => x.activity === 'Active').length} sub={`visited in the last ${gym?.settings?.inactiveDays || 14} days`} />
        <StatCard label="Check-ins (30 days)" value={all.reduce((a, x) => a + (x.visits30 || 0), 0)} sub="across all clients" />
        <StatCard label="Need a nudge" value={all.filter((x) => x.activity === 'Inactive').length} sub="inactive clients" />
      </Grid>
      <Section title="Clients" action={
        <Stack direction="row" spacing={1}>
          <TextField select size="small" value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ width: 130 }} fullWidth={false} inputProps={{ 'aria-label': 'Filter by activity' }}>
            {['All', 'Active', 'Inactive'].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
          </TextField>
          <TextField size="small" placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: 220 }} fullWidth={false} inputProps={{ 'aria-label': 'Search clients' }} />
        </Stack>
      }>
        <DataState {...c} onRetry={c.reload}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>Client</TableCell><TableCell>Goal</TableCell><TableCell>Programs</TableCell><TableCell>Membership</TableCell><TableCell>Last visit</TableCell><TableCell>Visits (30d)</TableCell><TableCell>Activity</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
              <TableBody>
                {rows.map((m) => (
                  <TableRow key={m._id}>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <UserAvatar name={m.name} src={m.avatarUrl} />
                        <Box><Typography variant="body2" fontWeight={700}>{m.name}</Typography><Typography variant="caption" color="text.secondary">{m.memberCode}{m.assignedToMe ? ' · 1-on-1' : ''}</Typography></Box>
                      </Stack>
                    </TableCell>
                    <TableCell>{m.fitnessGoal || '—'}</TableCell>
                    <TableCell>{m.programs?.filter(Boolean).join(', ') || '—'}</TableCell>
                    <TableCell><StatusChip label={m.status} /></TableCell>
                    <TableCell>{fdate(m.lastVisitAt)}</TableCell>
                    <TableCell>{m.visits30}</TableCell>
                    <TableCell><StatusChip label={m.activity} /></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" variant="outlined" onClick={() => navigate(`/coach/progress?member=${m._id}`)}>Progress</Button>
                        <Button size="small" variant="outlined" onClick={() => navigate(`/coach/messages?to=${m._id}`)}>Message</Button>
                        <Button size="small" variant={m.activity === 'Inactive' ? 'contained' : 'outlined'} onClick={() => openNudge(m)}>Nudge</Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!rows.length && <Empty>{all.length ? 'No clients match your search.' : 'No clients yet. Members appear here when they enroll in your programs or choose you as their coach.'}</Empty>}
          </Box>
        </DataState>
      </Section>
      <Dialog open={!!nudge} onClose={() => setNudge(null)} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: send }}>
        <DialogTitle>Send a re-engagement reminder</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{nudge?.name} gets this as a notification and an email.</Typography>
          <TextField label="Message" value={msg} onChange={(e) => setMsg(e.target.value)} multiline minRows={3} required inputProps={{ maxLength: 500 }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setNudge(null)}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={busy}>Send reminder</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
