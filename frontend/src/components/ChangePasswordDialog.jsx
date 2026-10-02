import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import api, { errMsg } from '../api';
import { useToast } from '../context/ToastContext';

export default function ChangePasswordDialog({ open, onClose }) {
  const toast = useToast();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (f.newPassword !== f.confirm) return toast('New passwords do not match', 'error');
    setBusy(true);
    try {
      await api.patch('/auth/password', f);
      toast('Password changed');
      setF({ currentPassword: '', newPassword: '', confirm: '' });
      onClose();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ component: 'form', onSubmit: submit }}>
      <DialogTitle>Change password</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField type="password" label="Current password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} required autoComplete="current-password" />
          <TextField type="password" label="New password" helperText="At least 8 characters" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} required inputProps={{ minLength: 8 }} autoComplete="new-password" />
          <TextField type="password" label="Confirm new password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required autoComplete="new-password" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={busy}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
