import { useState } from 'react';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Grid, Section, StatCard, StatusChip, Empty } from '../../components/ui';
import { fdate, fdt } from '../../utils/format';
import { brand } from '../../theme';

const TYPES = ['Inquiry', 'Membership', 'Coach Application', 'Support Request'];
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const TYPE_COLOR = { Inquiry: 'grey', Membership: 'amber', 'Coach Application': 'purple', 'Support Request': 'blue' };

export default function Support() {
  usePageTitle('Customer Support', 'Manage guest inquiries, membership questions, coach applications and support requests.');
  const toast = useToast();
  const [tab, setTab] = useState('');
  const [type, setType] = useState('');
  const t = useFetch('/inquiries', { params: { status: tab || undefined, inquiryType: type || undefined, limit: 200 } });
  const [open, setOpen] = useState(null);
  const [f, setF] = useState({ status: 'Open', response: '' });
  const [busy, setBusy] = useState(false);
  const counts = t.data?.counts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const items = t.data?.items || [];

  const show = (x) => {
    setOpen(x);
    setF({ status: x.status, response: x.response || '' });
  };
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { status: f.status };
      if (f.response.trim() && f.response !== (open.response || '')) body.response = f.response.trim();
      await api.patch(`/inquiries/${open._id}`, body);
      toast(`${open.inquiryNo} updated${open.sender ? ' and the sender was notified' : ''}`);
      setOpen(null);
      t.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Grid cols={{ xs: 1, sm: 2, lg: 4 }}>
        <StatCard label="Total inquiries" value={total} />
        <StatCard label="Open" value={counts.Open || 0} subColor={brand.orange} sub="waiting for a reply" />
        <StatCard label="In progress" value={counts['In Progress'] || 0} />
        <StatCard label="Resolved" value={(counts.Resolved || 0) + (counts.Closed || 0)} />
      </Grid>
      <Section>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
            <Tab value="" label="All" />
            {STATUSES.map((s) => <Tab key={s} value={s} label={s} />)}
          </Tabs>
          <TextField select value={type} onChange={(e) => setType(e.target.value)} sx={{ width: 210 }} SelectProps={{ displayEmpty: true }} inputProps={{ 'aria-label': 'Inquiry type' }}>
            <MenuItem value="">All types</MenuItem>
            {TYPES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
        </Stack>
        <DataState {...t} onRetry={t.reload}>
          <Box sx={{ overflowX: 'auto', mt: 1 }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>No.</TableCell><TableCell>From</TableCell><TableCell>Subject</TableCell><TableCell>Type</TableCell><TableCell>Date</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {items.map((x) => (
                  <TableRow key={x._id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{x.inquiryNo}</TableCell>
                    <TableCell><b>{x.fullName}</b><Typography variant="caption" display="block" color="text.secondary">{x.senderType}{x.contact ? ` · ${x.contact}` : ''}</Typography></TableCell>
                    <TableCell>{x.subject}</TableCell>
                    <TableCell><StatusChip label={x.inquiryType} color={TYPE_COLOR[x.inquiryType]} /></TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{fdate(x.createdAt)}</TableCell>
                    <TableCell><StatusChip label={x.status} /></TableCell>
                    <TableCell><Button size="small" variant="outlined" onClick={() => show(x)}>Open</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!items.length && <Empty>No inquiries here.</Empty>}
          </Box>
        </DataState>
      </Section>

      <Dialog open={!!open} onClose={() => setOpen(null)} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: save }}>
        <DialogTitle>{open?.subject}</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip size="small" label={open?.inquiryType} />
            <Typography variant="body2" color="text.secondary">{open?.inquiryNo} · {open?.fullName} ({open?.senderType}){open?.contact ? ` · ${open.contact}` : ''} · {fdt(open?.createdAt)}</Typography>
          </Stack>
          <Box sx={{ bgcolor: brand.fill, p: 1.5, borderRadius: 2, my: 2, whiteSpace: 'pre-wrap' }}>
            <Typography variant="body2">{open?.message || 'No message.'}</Typography>
          </Box>
          {open?.respondedAt && <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>Last response {fdt(open.respondedAt)}</Typography>}
          <Stack spacing={2}>
            <TextField select label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField>
            <TextField
              label={open?.sender ? 'Reply (they get a notification)' : 'Response note (reply to guests by phone or email)'}
              value={f.response}
              onChange={(e) => setF({ ...f, response: e.target.value })}
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setOpen(null)}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={busy}>Update</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
