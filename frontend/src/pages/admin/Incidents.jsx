import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { usePageTitle, useBase } from '../../components/AppShell';
import { DataState, Grid, Section, StatCard, StatusChip, Empty } from '../../components/ui';
import { fdate, fdt, ago } from '../../utils/format';
import { brand } from '../../theme';

const CATEGORIES = ['Equipment', 'Facility', 'Billing', 'Coach', 'Safety', 'Feedback', 'Other'];
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const PRIORITIES = ['Low', 'Normal', 'High'];

export default function Incidents() {
  usePageTitle('Incident Reports', 'Track and resolve concerns reported by members and coaches.');
  const toast = useToast();
  const base = useBase();
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const r = useFetch('/incidents', { params: { status: status || undefined, category: category || undefined, limit: 200 } });
  const [open, setOpen] = useState(null);
  const [f, setF] = useState({ status: 'Open', priority: 'Normal', category: 'Other', resolution: '' });
  const [busy, setBusy] = useState(false);
  const counts = r.data?.counts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const items = useMemo(() => (r.data?.items || []).filter((x) => !priority || x.priority === priority), [r.data, priority]);

  const show = (x) => {
    setOpen(x);
    setF({ status: x.status, priority: x.priority || 'Normal', category: x.category, resolution: x.resolution || '' });
  };
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { status: f.status, priority: f.priority, category: f.category };
      if (f.resolution.trim() && f.resolution !== (open.resolution || '')) body.resolution = f.resolution.trim();
      await api.patch(`/incidents/${open._id}`, body);
      toast(`${open.reportNo} updated and the reporter was notified`);
      setOpen(null);
      r.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Grid cols={{ xs: 1, sm: 2, lg: 4 }}>
        <StatCard label="Total reports" value={total} />
        <StatCard label="Open" value={counts.Open || 0} sub="waiting for action" subColor={brand.orange} />
        <StatCard label="In progress" value={counts['In Progress'] || 0} />
        <StatCard label="Resolved / closed" value={(counts.Resolved || 0) + (counts.Closed || 0)} />
      </Grid>
      <Section>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
          <Tabs value={status} onChange={(_, v) => setStatus(v)} variant="scrollable">
            <Tab value="" label="All" />
            {STATUSES.map((s) => <Tab key={s} value={s} label={s} />)}
          </Tabs>
          <Stack direction="row" spacing={1}>
            <TextField select value={category} onChange={(e) => setCategory(e.target.value)} sx={{ width: 170 }} SelectProps={{ displayEmpty: true }} inputProps={{ 'aria-label': 'Category' }}>
              <MenuItem value="">All categories</MenuItem>
              {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField select value={priority} onChange={(e) => setPriority(e.target.value)} sx={{ width: 150 }} SelectProps={{ displayEmpty: true }} inputProps={{ 'aria-label': 'Priority' }}>
              <MenuItem value="">All priorities</MenuItem>
              {PRIORITIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Stack>
        </Stack>
        <DataState {...r} onRetry={r.reload}>
          <Box sx={{ overflowX: 'auto', mt: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow><TableCell>Report</TableCell><TableCell>Reported by</TableCell><TableCell>Subject</TableCell><TableCell>Category</TableCell><TableCell>Priority</TableCell><TableCell>Date</TableCell><TableCell>Status</TableCell><TableCell /></TableRow>
              </TableHead>
              <TableBody>
                {items.map((x) => (
                  <TableRow key={x._id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{x.reportNo}</TableCell>
                    <TableCell><b>{x.reporterName}</b><Typography variant="caption" display="block" color="text.secondary">{x.reporterType}</Typography></TableCell>
                    <TableCell>
                      {x.subject}
                      {x.equipment && <Typography variant="caption" display="block" color="text.secondary">{x.equipment.equipmentName} {x.equipment.code || ''}</Typography>}
                    </TableCell>
                    <TableCell><Chip size="small" label={x.category} /></TableCell>
                    <TableCell><StatusChip label={x.priority} color={x.priority === 'High' ? 'red' : x.priority === 'Low' ? 'grey' : 'amber'} /></TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{fdate(x.dateReported)}</TableCell>
                    <TableCell><StatusChip label={x.status} /></TableCell>
                    <TableCell><Button size="small" variant="outlined" onClick={() => show(x)}>Open</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!items.length && <Empty>No incident reports here.</Empty>}
          </Box>
        </DataState>
      </Section>

      <Dialog open={!!open} onClose={() => setOpen(null)} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: save }}>
        <DialogTitle>{open?.subject}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {open?.reportNo} · {open?.reporterName} ({open?.reporterType}) · {fdt(open?.dateReported)}
          </Typography>
          {open?.equipment && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Equipment: <b>{open.equipment.equipmentName} {open.equipment.code || ''}</b>{' '}
              <Button size="small" component={RouterLink} to={`${base}/equipment`}>View equipment</Button>
            </Typography>
          )}
          <Box sx={{ bgcolor: brand.fill, p: 1.5, borderRadius: 2, my: 2, whiteSpace: 'pre-wrap' }}>
            <Typography variant="body2">{open?.description || 'No description given.'}</Typography>
          </Box>
          <Stack spacing={2}>
            <Grid cols={{ xs: 1, sm: 3 }}>
              <TextField select label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField>
              <TextField select label="Priority" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{PRIORITIES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField>
              <TextField select label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField>
            </Grid>
            <TextField label="Resolution / reply to the reporter" value={f.resolution} onChange={(e) => setF({ ...f, resolution: e.target.value })} multiline minRows={3} helperText="The reporter gets a notification with this message." />
            {open?.resolvedAt && <Typography variant="caption" color="text.secondary">Resolved {fdt(open.resolvedAt)}</Typography>}
            {open?.history?.length > 0 && (
              <Box>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>History</Typography>
                <Stack spacing={0} sx={{ borderLeft: `2px solid ${brand.line}`, ml: 0.75 }}>
                  {[...open.history].reverse().map((h, i) => (
                    <Box key={h._id || i} sx={{ position: 'relative', pl: 2, pb: 1.25 }}>
                      <Box sx={{ position: 'absolute', left: -6, top: 4, width: 10, height: 10, borderRadius: '50%', bgcolor: i === 0 ? brand.yellow : brand.line }} />
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="body2" fontWeight={700}>{h.note || h.status}</Typography>
                        {h.status && <StatusChip label={h.status} />}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">{h.byName} · {fdt(h.at)} · {ago(h.at)}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setOpen(null)}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={busy}>Update report</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
