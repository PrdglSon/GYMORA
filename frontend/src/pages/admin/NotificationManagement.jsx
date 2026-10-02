import { useState } from 'react';
import { Alert, Box, Button, FormControlLabel, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Grid, Section, StatCard, Progress, Empty } from '../../components/ui';
import { fdt, pct } from '../../utils/format';

const AUDIENCES = [['members', 'All members'], ['coaches', 'All coaches'], ['staff', 'All staff'], ['all', 'Everyone']];
const TYPES = ['Promotion', 'Announcement', 'Event', 'Reminder'];
const LINKS = [['', 'No link'], ['/member/programs', 'Member: Programs'], ['/member/payments', 'Member: Payments'], ['/member/progress', 'Member: Progress'], ['/member/community', 'Member: Community'], ['/coach/schedule', 'Coach: Schedule'], ['/coach/clients', 'Coach: Clients']];
const blank = { audience: 'members', notificationType: 'Announcement', title: '', message: '', link: '', email: false };

export default function NotificationManagement() {
  usePageTitle('Notification Management', 'Send announcements, promotions and reminders to members, coaches and staff.');
  const toast = useToast();
  const sent = useFetch('/notifications/sent', { initial: [] });
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);
  const list = sent.data || [];
  const totalRecipients = list.reduce((a, x) => a + x.recipients, 0);
  const totalRead = list.reduce((a, x) => a + x.read, 0);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { audience: f.audience, notificationType: f.notificationType, title: f.title.trim(), message: f.message.trim(), email: f.email };
      if (f.link) body.link = f.link;
      const { data } = await api.post('/notifications/broadcast', body);
      setLast({ count: data.sent, title: body.title });
      toast(`Sent to ${data.sent} recipient${data.sent === 1 ? '' : 's'}`);
      setF(blank);
      sent.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Grid cols={{ xs: 1, sm: 3 }}>
        <StatCard label="Broadcasts sent" value={list.length} sub="most recent 30" />
        <StatCard label="Total recipients" value={totalRecipients} />
        <StatCard label="Read rate" value={`${pct(totalRead, totalRecipients)}%`} sub={`${totalRead} read`} />
      </Grid>
      <Grid cols={{ xs: 1, md: '2fr 3fr' }}>
        <Section title="Compose">
          <Stack component="form" spacing={2} onSubmit={submit}>
            <Grid cols={{ xs: 1, sm: 2 }}>
              <TextField select label="Send to" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
                {AUDIENCES.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
              </TextField>
              <TextField select label="Type" value={f.notificationType} onChange={(e) => setF({ ...f, notificationType: e.target.value })}>
                {TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Grid>
            <TextField label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required inputProps={{ maxLength: 120 }} />
            <TextField label="Message" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} required multiline minRows={4} inputProps={{ maxLength: 1000 }} helperText={`${f.message.length}/1000`} />
            <TextField select label="Open page when tapped" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
              {LINKS.map(([v, l]) => <MenuItem key={v || 'none'} value={v}>{l}</MenuItem>)}
            </TextField>
            <FormControlLabel control={<Switch checked={f.email} onChange={(e) => setF({ ...f, email: e.target.checked })} />} label="Also send by email" />
            {last && <Alert severity="success" onClose={() => setLast(null)}>"{last.title}" was delivered to {last.count} recipient{last.count === 1 ? '' : 's'}.</Alert>}
            <Box><Button type="submit" variant="contained" disabled={busy}>{busy ? 'Sending…' : 'Send notification'}</Button></Box>
          </Stack>
        </Section>
        <Section title="Sent history">
          <DataState {...sent} onRetry={sent.reload}>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead><TableRow><TableCell>Sent</TableCell><TableCell>Notification</TableCell><TableCell align="right">Recipients</TableCell><TableCell>Read</TableCell></TableRow></TableHead>
                <TableBody>
                  {list.map((x, i) => (
                    <TableRow key={`${x.title}-${i}`}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{fdt(x.sentAt)}</TableCell>
                      <TableCell><Typography variant="body2" fontWeight={700}>{x.title}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{x.message}</Typography></TableCell>
                      <TableCell align="right">{x.recipients}</TableCell>
                      <TableCell><Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 110 }}><Progress value={pct(x.read, x.recipients)} /><Typography variant="caption">{pct(x.read, x.recipients)}%</Typography></Stack></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!list.length && <Empty>No broadcasts sent yet.</Empty>}
            </Box>
          </DataState>
        </Section>
      </Grid>
    </Stack>
  );
}
