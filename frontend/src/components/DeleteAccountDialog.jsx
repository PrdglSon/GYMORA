import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';

export default function DeleteAccountDialog({ open, title, expect, kind = 'member', onClose, onConfirm }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setText(''); }, [open]);
  const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const ok = norm(text) === norm(expect);
  const go = async () => {
    setBusy(true);
    try {
      await onConfirm(text.trim());
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Alert severity="error" sx={{ mb: 2 }}>
          This permanently removes the {kind}'s account and personal details (name, email, phone, photo and login). It cannot be undone.
        </Alert>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {kind === 'member'
            ? 'Payments, attendance and sales stay in your records as "Deleted member" so reports and receipts stay correct. Progress, badges, enrollments and messages are removed.'
            : kind === 'staff'
              ? 'Sales, payments and stock changes they handled stay in your records so reports and receipts stay correct. Their posts and replies show as "Deleted staff". They can no longer log in.'
              : 'Past sessions, payments and reports stay as "Deleted coach". Upcoming bookings are cancelled and members are notified. Programs stay without a coach until you assign a new one.'}
        </Typography>
        <TextField fullWidth autoFocus label={`Type ${expect} to confirm`} value={text} onChange={(e) => setText(e.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" disabled={!ok || busy} onClick={go}>Delete permanently</Button>
      </DialogActions>
    </Dialog>
  );
}
