import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Grid, Section, StatCard, StatusChip, ConfirmDialog, Empty } from '../../components/ui';
import { fdate, fdt, isoDay } from '../../utils/format';
import { brand } from '../../theme';

const STATUSES = ['Operational', 'Needs Maintenance', 'Under Repair', 'Out of Order'];
const d10 = (d) => (d ? isoDay(d) : '');

export default function Equipment() {
  usePageTitle('Equipment', 'Track machines, maintenance schedules and repair status.');
  const { role } = useAuth();
  const admin = role === 'admin';
  const toast = useToast();
  const [filter, setFilter] = useState('');
  const e = useFetch('/equipment', { params: { status: filter || undefined }, initial: [] });
  const all = useFetch('/equipment', { initial: [] });
  const [edit, setEdit] = useState(undefined);
  const [f, setF] = useState(null);
  const [log, setLog] = useState(null);
  const [service, setService] = useState(null);
  const [sv, setSv] = useState({ logNote: '', lastServicedAt: '', nextServiceAt: '' });
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const list = e.data || [];
  const everything = all.data || [];
  const reload = () => {
    e.reload();
    all.reload();
  };
  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (x, status) => act(async () => {
    await api.patch(`/equipment/${x._id}`, { status, ...(status === 'Operational' && x.status !== 'Operational' ? { lastServicedAt: new Date() } : {}) });
    toast(`${x.equipmentName}${x.code ? ` ${x.code}` : ''}: ${status}`);
    reload();
  });
  const openEdit = (x) => {
    setF(x
      ? { equipmentName: x.equipmentName, code: x.code || '', category: x.category || '', location: x.location || '', status: x.status, purchaseDate: d10(x.purchaseDate), lastServicedAt: d10(x.lastServicedAt), nextServiceAt: d10(x.nextServiceAt), notes: x.notes || '' }
      : { equipmentName: '', code: '', category: 'Cardio', location: '', status: 'Operational', purchaseDate: '', lastServicedAt: '', nextServiceAt: '', notes: '' });
    setEdit(x || null);
  };
  const save = (ev) => {
    ev.preventDefault();
    act(async () => {
      const body = { ...f, purchaseDate: f.purchaseDate || undefined, lastServicedAt: f.lastServicedAt || undefined, nextServiceAt: f.nextServiceAt || undefined };
      if (edit) await api.patch(`/equipment/${edit._id}`, body);
      else await api.post('/equipment', body);
      toast('Equipment saved');
      setEdit(undefined);
      reload();
    });
  };
  const openService = (x) => {
    setSv({ logNote: '', lastServicedAt: isoDay(), nextServiceAt: d10(x.nextServiceAt), notes: x.notes || '' });
    setService(x);
  };
  const saveService = (ev) => {
    ev.preventDefault();
    act(async () => {
      const { data } = await api.patch(`/equipment/${service._id}`, { logNote: sv.logNote, lastServicedAt: sv.lastServicedAt || undefined, nextServiceAt: sv.nextServiceAt || undefined, notes: sv.notes });
      toast(`Maintenance logged for ${data.equipmentName}`);
      setService(null);
      reload();
    });
  };
  const doDelete = () => act(async () => {
    await api.delete(`/equipment/${del._id}`);
    toast(`${del.equipmentName} removed`);
    setDel(null);
    reload();
  });
  const count = (s) => everything.filter((x) => x.status === s).length;
  return (
    <Stack spacing={2}>
      <Grid cols={{ xs: 1, sm: 2, lg: 4 }}>
        <StatCard label="Equipment" value={everything.length} sub="tracked items" />
        <StatCard label="Operational" value={count('Operational')} sub="ready to use" subColor={brand.green} />
        <StatCard label="Needs attention" value={count('Needs Maintenance') + count('Under Repair') + count('Out of Order')} sub={`${count('Out of Order')} out of order`} subColor={brand.orange} />
        <StatCard label="Service due (7 days)" value={everything.filter((x) => x.serviceDue).length} sub="scheduled maintenance" />
      </Grid>
      <Section
        title="Equipment list"
        action={(
          <Stack direction="row" spacing={1}>
            <TextField size="small" select value={filter} onChange={(ev) => setFilter(ev.target.value)} sx={{ width: 190 }} SelectProps={{ displayEmpty: true }} inputProps={{ 'aria-label': 'Status filter' }}>
              <MenuItem value="">All statuses</MenuItem>{STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
            {admin && <Button variant="contained" startIcon={<AddIcon />} onClick={() => openEdit(null)}>Add equipment</Button>}
          </Stack>
        )}
      >
        <DataState {...e} onRetry={e.reload}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>Equipment</TableCell><TableCell>Location</TableCell><TableCell>Purchased</TableCell><TableCell>Last serviced</TableCell><TableCell>Next service</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {list.map((x) => (
                  <TableRow key={x._id} sx={{ bgcolor: x.serviceDue ? brand.yellowSoft : undefined }}>
                    <TableCell><b>{x.equipmentName}</b> {x.code}<Typography variant="caption" display="block" color="text.secondary">{x.category}{x.notes ? ` · ${x.notes}` : ''}</Typography></TableCell>
                    <TableCell>{x.location || '—'}</TableCell>
                    <TableCell>{fdate(x.purchaseDate)}</TableCell>
                    <TableCell>{fdate(x.lastServicedAt)}</TableCell>
                    <TableCell>{x.nextServiceAt ? <Stack direction="row" spacing={0.5} alignItems="center"><span>{fdate(x.nextServiceAt)}</span>{x.serviceDue && <StatusChip label="Due" color="amber" />}</Stack> : '—'}</TableCell>
                    <TableCell><Select size="small" value={x.status} disabled={busy} onChange={(ev) => setStatus(x, ev.target.value)} inputProps={{ 'aria-label': `Status of ${x.equipmentName}` }}>{STATUSES.map((s) => <MenuItem key={s} value={s}><StatusChip label={s} /></MenuItem>)}</Select></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="contained" onClick={() => openService(x)}>Log service</Button>
                        <Button size="small" variant="outlined" onClick={() => setLog(x)}>History</Button>
                        {admin && <Button size="small" variant="outlined" onClick={() => openEdit(x)}>Edit</Button>}
                        {admin && <Button size="small" color="error" onClick={() => setDel(x)}>Delete</Button>}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!list.length && <Empty>No equipment found.</Empty>}
          </Box>
        </DataState>
      </Section>

      <Dialog open={edit !== undefined} onClose={() => setEdit(undefined)} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: save }}>
        <DialogTitle>{edit ? `Edit ${edit.equipmentName}` : 'Add equipment'}</DialogTitle>
        <DialogContent>
          {f && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Grid cols={{ xs: 1, sm: 2 }}>
                <TextField label="Equipment name" value={f.equipmentName} onChange={(ev) => setF({ ...f, equipmentName: ev.target.value })} required />
                <TextField label="Code" placeholder="TM-03" value={f.code} onChange={(ev) => setF({ ...f, code: ev.target.value })} />
                <TextField label="Category" value={f.category} onChange={(ev) => setF({ ...f, category: ev.target.value })} />
                <TextField label="Location" value={f.location} onChange={(ev) => setF({ ...f, location: ev.target.value })} />
                <TextField select label="Status" value={f.status} onChange={(ev) => setF({ ...f, status: ev.target.value })}>{STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField>
                <TextField type="date" label="Purchase date" value={f.purchaseDate} onChange={(ev) => setF({ ...f, purchaseDate: ev.target.value })} InputLabelProps={{ shrink: true }} />
                <TextField type="date" label="Last serviced" value={f.lastServicedAt} onChange={(ev) => setF({ ...f, lastServicedAt: ev.target.value })} InputLabelProps={{ shrink: true }} />
                <TextField type="date" label="Next service" value={f.nextServiceAt} onChange={(ev) => setF({ ...f, nextServiceAt: ev.target.value })} InputLabelProps={{ shrink: true }} />
              </Grid>
              <TextField label="Notes" value={f.notes} onChange={(ev) => setF({ ...f, notes: ev.target.value })} multiline minRows={2} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={() => setEdit(undefined)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy}>Save</Button></DialogActions>
      </Dialog>

      <Dialog open={!!service} onClose={() => setService(null)} maxWidth="xs" fullWidth PaperProps={{ component: 'form', onSubmit: saveService }}>
        <DialogTitle>Log maintenance · {service?.equipmentName} {service?.code}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Work done" placeholder="e.g. Replaced belt, lubricated deck" value={sv.logNote} onChange={(ev) => setSv({ ...sv, logNote: ev.target.value })} required multiline minRows={2} />
            <TextField type="date" label="Serviced on" value={sv.lastServicedAt} onChange={(ev) => setSv({ ...sv, lastServicedAt: ev.target.value })} InputLabelProps={{ shrink: true }} />
            <TextField type="date" label="Next service" value={sv.nextServiceAt} onChange={(ev) => setSv({ ...sv, nextServiceAt: ev.target.value })} InputLabelProps={{ shrink: true }} />
            <TextField label="Notes" value={sv.notes} onChange={(ev) => setSv({ ...sv, notes: ev.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={() => setService(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy}>Save log</Button></DialogActions>
      </Dialog>

      <Dialog open={!!log} onClose={() => setLog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Maintenance history · {log?.equipmentName} {log?.code}</DialogTitle>
        <DialogContent>
          {[...(log?.maintenanceLog || [])].reverse().map((l, i) => (
            <Box key={l._id || i} sx={{ py: 0.8, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="body2">{l.action}</Typography>
              <Typography variant="caption" color="text.secondary">{fdt(l.date)}{l.byName ? ` · ${l.byName}` : ''}</Typography>
            </Box>
          ))}
          {!log?.maintenanceLog?.length && <Empty>No maintenance logged yet.</Empty>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={() => setLog(null)}>Close</Button></DialogActions>
      </Dialog>
      <ConfirmDialog open={!!del} title={`Delete ${del?.equipmentName}?`} message="This removes the equipment and its maintenance history." confirmLabel="Delete" danger busy={busy} onClose={() => setDel(null)} onConfirm={doDelete} />
    </Stack>
  );
}
