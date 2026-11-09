import { useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableRow, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import api, { errMsg } from '../api';
import useFetch from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { keepOpenOnTapOutside } from '../hooks/useDraft';
import { ConfirmDialog } from './ui';
import { NameField } from './ContactFields';
import { ftime, isoDay, peso } from '../utils/format';
import { brand } from '../theme';

const GCASH_BLUE = '#0A63F6';

export default function GcashTally({ date, onChanged, compact }) {
  const { role } = useAuth();
  const toast = useToast();
  const list = useFetch('/gcash', { params: { date } });
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const today = isoDay();
  const locked = role !== 'admin' && date < today;
  const items = list.data?.items || [];
  const refresh = () => {
    list.reload();
    onChanged?.();
  };
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { date: edit.date, amount: edit.amount, referenceNumber: edit.referenceNumber, payerName: edit.payerName, note: edit.note };
      if (edit._id) await api.patch(`/gcash/${edit._id}`, body);
      else await api.post('/gcash', body);
      toast(edit._id ? 'GCash entry updated' : `${peso(edit.amount)} added to the GCash total`);
      setEdit(null);
      refresh();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/gcash/${del._id}`);
      toast('GCash entry deleted');
      setDel(null);
      refresh();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box sx={{ border: `1px solid ${brand.line}`, borderRadius: 3, overflow: 'hidden' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.5, bgcolor: '#EEF4FF', borderBottom: `1px solid ${brand.line}` }} spacing={1}>
        <Box>
          <Typography variant="subtitle2" sx={{ color: GCASH_BLUE }}>GCash tally</Typography>
          <Typography variant="caption" color="text.secondary">Total recorded: <b style={{ color: GCASH_BLUE }}>{peso(list.data?.total || 0)}</b></Typography>
        </Box>
        <Button size="small" variant="contained" startIcon={<AddIcon />} disabled={locked} onClick={() => setEdit({ date, amount: '', referenceNumber: '', payerName: '', note: '' })} sx={{ bgcolor: GCASH_BLUE, '&:hover': { bgcolor: '#0850c4' } }}>Record GCash</Button>
      </Stack>
      <Box sx={{ px: 2, py: 1.5 }}>
        {!compact && <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>Check the gym's GCash app and record each GCash payment received. These amounts are moved out of Cash and counted as GCash in the reports.</Typography>}
        {list.loading && !list.data ? <Typography variant="body2" color="text.secondary">Loading…</Typography> : items.length ? (
          <Table size="small">
            <TableBody>
              {items.map((x) => (
                <TableRow key={x._id}>
                  <TableCell sx={{ pl: 0 }}>
                    <Typography variant="body2" fontWeight={700}>{x.payerName || 'GCash payment'}{x.referenceNumber && <Typography component="span" variant="caption" color="text.secondary"> · Ref {x.referenceNumber}</Typography>}</Typography>
                    <Typography variant="caption" color="text.secondary">{ftime(x.createdAt)}{x.recordedByName ? ` · by ${x.recordedByName}` : ''}{x.note ? ` · ${x.note}` : ''}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{peso(x.amount)}</TableCell>
                  <TableCell align="right" sx={{ pr: 0, whiteSpace: 'nowrap' }}>
                    {!locked && <Button size="small" onClick={() => setEdit({ _id: x._id, date: isoDay(x.date), amount: String(x.amount), referenceNumber: x.referenceNumber || '', payerName: x.payerName || '', note: x.note || '' })}>Edit</Button>}
                    {!locked && <Button size="small" color="error" onClick={() => setDel(x)}>Delete</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Typography variant="body2" color="text.secondary">No GCash payments recorded for this day yet.</Typography>
        )}
        {locked && <Alert severity="info" sx={{ mt: 1 }}>Only the administrator can change entries from previous days.</Alert>}
      </Box>
      <Dialog open={!!edit} onClose={keepOpenOnTapOutside(() => setEdit(null))} maxWidth="xs" fullWidth PaperProps={{ component: 'form', onSubmit: save }}>
        <DialogTitle>{edit?._id ? 'Edit GCash entry' : 'Record GCash payment'}</DialogTitle>
        <DialogContent>
          {edit && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Amount received (₱)" type="number" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} inputProps={{ min: 0.01, step: '0.01' }} required autoFocus />
              <TextField label="GCash reference number" value={edit.referenceNumber} onChange={(e) => setEdit({ ...edit, referenceNumber: e.target.value })} helperText="The 13-digit reference from the GCash receipt (optional)" />
              <NameField label="Paid by (optional)" value={edit.payerName} onChange={(e) => setEdit({ ...edit, payerName: e.target.value })} />
              <TextField label="Date received" type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} InputLabelProps={{ shrink: true }} inputProps={{ max: today }} required disabled={role !== 'admin'} />
              <TextField label="Note (optional)" placeholder="e.g. Walk-in day pass, Monthly plan" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy}>Save</Button></DialogActions>
      </Dialog>
      <ConfirmDialog open={!!del} title="Delete this GCash entry?" message={del ? `${peso(del.amount)}${del.payerName ? ` from ${del.payerName}` : ''}. The amount goes back to Cash in the reports.` : ''} confirmLabel="Delete" danger busy={busy} onClose={() => setDel(null)} onConfirm={remove} />
    </Box>
  );
}
