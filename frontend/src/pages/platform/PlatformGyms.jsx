import { useMemo, useState } from 'react';
import { Box, Button, Link, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import api, { errMsg } from '../../api';
import { Alert, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { usePageTitle } from '../../components/AppShell';
import { ConfirmDialog, DataState, Grid, Section, StatCard, StatusChip, Empty } from '../../components/ui';
import { fdate } from '../../utils/format';

const STATUS_COLOR = { active: 'green', pending: 'amber', suspended: 'red' };

export default function PlatformGyms() {
  usePageTitle('Gyms', 'Approve, suspend, delete and monitor gyms on the GYMORA platform.');
  const toast = useToast();
  const g = useFetch('/platform/gyms', { initial: [] });
  const s = useFetch('/platform/stats');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(null);
  const [typed, setTyped] = useState('');

  const exportData = async (gym) => {
    try {
      const { data } = await api.get(`/platform/gyms/${gym._id}/export`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `gymora-${gym.slug}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const remove = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.delete(`/platform/gyms/${del._id}`, { data: { confirm: typed } });
      toast(`${del.name} and all its data were deleted`);
      setDel(null);
      setTyped('');
      g.reload();
      s.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (g.data || []).filter((x) => (filter === 'all' || x.status === filter) && (!term || [x.name, x.slug, x.city, x.owner?.email].filter(Boolean).some((v) => v.toLowerCase().includes(term))));
  }, [g.data, filter, q]);

  const apply = async (gym, status) => {
    setBusy(true);
    try {
      await api.patch(`/platform/gyms/${gym._id}`, { status });
      toast(`${gym.name}: ${status === 'active' ? 'active' : status}`);
      setConfirm(null);
      g.reload();
      s.reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Grid cols={{ xs: 1, sm: 2, lg: 4 }}>
        <StatCard label="Gyms" value={s.data?.gyms ?? '—'} sub="Registered on GYMORA" />
        <StatCard label="Active" value={s.data?.active ?? '—'} sub="Live and accepting members" />
        <StatCard label="Waiting for approval" value={s.data?.pending ?? '—'} sub="Review below" subColor={s.data?.pending ? 'warning.main' : undefined} />
        <StatCard label="User accounts" value={s.data?.accounts ?? '—'} sub="Members, coaches and staff" />
      </Grid>
      <Section
        title="All gyms"
        action={(
          <Stack direction="row" spacing={1}>
            <TextField placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: 200 }} />
            <TextField select value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ width: 150 }}>
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
            </TextField>
          </Stack>
        )}
      >
        <DataState loading={g.loading} error={g.error} data={g.data} onRetry={g.reload}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Gym</TableCell><TableCell>Owner</TableCell><TableCell>City</TableCell><TableCell>Est. members</TableCell>
                  <TableCell align="right">Members</TableCell><TableCell>Registered</TableCell><TableCell>Status</TableCell><TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((x) => (
                  <TableRow key={x._id} hover>
                    <TableCell>
                      <b>{x.name}</b>
                      <Link href={`/g/${x.slug}`} target="_blank" rel="noreferrer" variant="caption" display="block" color="text.secondary">/g/{x.slug}</Link>
                    </TableCell>
                    <TableCell>
                      {x.owner ? `${x.owner.firstName} ${x.owner.lastName}` : '—'}
                      <Typography variant="caption" display="block" color="text.secondary">{[x.owner?.email, x.owner?.phoneNumber].filter(Boolean).join(' · ')}</Typography>
                    </TableCell>
                    <TableCell>{x.city || '—'}</TableCell>
                    <TableCell>{x.estimatedMembers || '—'}</TableCell>
                    <TableCell align="right">{x.members}</TableCell>
                    <TableCell>{fdate(x.createdAt)}</TableCell>
                    <TableCell><StatusChip label={x.status} color={STATUS_COLOR[x.status]} /></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        {x.status !== 'active' && <Button size="small" variant="contained" onClick={() => apply(x, 'active')} disabled={busy}>{x.status === 'pending' ? 'Approve' : 'Reactivate'}</Button>}
                        {x.status !== 'suspended' && <Button size="small" color="error" onClick={() => setConfirm(x)} disabled={busy}>{x.status === 'pending' ? 'Reject' : 'Suspend'}</Button>}
                        {x.status === 'suspended' && <Button size="small" color="error" variant="outlined" onClick={() => { setDel(x); setTyped(''); }} disabled={busy}>Delete</Button>}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!rows.length && <Empty>{g.data?.length ? 'No gyms match the filter.' : 'No gyms yet.'}</Empty>}
          </Box>
        </DataState>
      </Section>
      <Dialog open={!!del} onClose={() => setDel(null)} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: remove }}>
        <DialogTitle>Delete {del?.name}?</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="error">This permanently deletes the gym and all of its data: members, coaches, staff accounts, memberships, payments, attendance, programs, POS sales, inventory, reports and audit logs. It cannot be undone.</Alert>
            <Typography variant="body2">Download a copy of the gym's data first if the owner may need their records.</Typography>
            <Button variant="outlined" onClick={() => exportData(del)} sx={{ alignSelf: 'flex-start' }}>Download data (JSON)</Button>
            <TextField label={`Type ${del?.slug || ''} to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setDel(null)}>Cancel</Button>
          <Button type="submit" variant="contained" color="error" disabled={busy || typed !== del?.slug}>Delete permanently</Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog
        open={!!confirm}
        title={`Suspend ${confirm?.name || 'gym'}?`}
        message="Its public page, kiosk and online sign-up will stop working until you reactivate it."
        confirmLabel="Suspend"
        danger
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => apply(confirm, 'suspended')}
      />
    </Stack>
  );
}
