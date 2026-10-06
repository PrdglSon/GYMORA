import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import dayjs from 'dayjs';
import api, { errMsg } from '../api';
import { useToast } from '../context/ToastContext';
import { fday, hhmm12 } from '../utils/format';

export const sessionStart = (b) => dayjs(`${dayjs(b.sessionDate).format('YYYY-MM-DD')}T${b.startTime}`);

const DIALOGS = {
  decline: { title: 'Decline this booking?', field: 'Reason for the member (optional)', button: 'Decline', color: 'error', url: 'decline', key: 'note', done: 'Booking declined' },
  cancel: { title: 'Cancel this booking?', field: 'Reason (optional)', button: 'Cancel booking', color: 'error', url: 'cancel', key: 'reason', done: 'Booking cancelled' },
  approve: { title: 'Approve this booking?', field: 'Note for the member (optional)', button: 'Approve', color: 'primary', url: 'approve', key: 'note', done: 'Booking approved' },
  complete: { title: 'Mark session as completed?', field: 'Session note for the member (optional)', button: 'Mark completed', color: 'primary', url: 'complete', key: 'note', extra: { outcome: 'Completed' }, done: 'Session marked completed' },
  noshow: { title: 'Mark as no-show?', field: 'Note (optional)', button: 'Mark no-show', color: 'error', url: 'complete', key: 'note', extra: { outcome: 'No-show' }, done: 'Marked as no-show' },
};

export default function BookingActions({ b, onDone, size = 'small' }) {
  const toast = useToast();
  const [open, setOpen] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const started = sessionStart(b).isBefore(dayjs());
  const cfg = open && DIALOGS[open];

  const run = async () => {
    setBusy(true);
    try {
      await api.patch(`/bookings/${b._id}/${cfg.url}`, { [cfg.key]: text || undefined, ...(cfg.extra || {}) });
      toast(cfg.done);
      setOpen(null);
      setText('');
      onDone?.();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        {b.status === 'Pending' && !started && <Button size={size} variant="contained" onClick={() => setOpen('approve')}>Approve</Button>}
        {b.status === 'Pending' && <Button size={size} color="error" onClick={() => setOpen('decline')}>Decline</Button>}
        {b.status === 'Approved' && started && <Button size={size} variant="contained" onClick={() => setOpen('complete')}>Completed</Button>}
        {b.status === 'Approved' && started && <Button size={size} color="error" onClick={() => setOpen('noshow')}>No-show</Button>}
        {b.status === 'Approved' && !started && <Button size={size} color="error" onClick={() => setOpen('cancel')}>Cancel</Button>}
      </Stack>
      <Dialog open={!!cfg} onClose={() => setOpen(null)} maxWidth="xs" fullWidth>
        {cfg && (
          <>
            <DialogTitle>{cfg.title}</DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ mb: 2 }}>{[b.memberName, b.coachName].filter(Boolean).join(' with ')} · {fday(b.sessionDate)} · {hhmm12(b.startTime)} – {hhmm12(b.endTime)}</Typography>
              <TextField fullWidth multiline minRows={2} label={cfg.field} value={text} onChange={(e) => setText(e.target.value)} inputProps={{ maxLength: 300 }} />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(null)}>Back</Button>
              <Button variant="contained" color={cfg.color} disabled={busy} onClick={run}>{cfg.button}</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
