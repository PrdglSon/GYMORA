import { useState } from 'react';
import { Box, Button, Card, CardContent, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import ReportProblemOutlined from '@mui/icons-material/ReportProblemOutlined';
import SupportAgentOutlined from '@mui/icons-material/SupportAgentOutlined';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../context/SocketContext';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Grid, Section, StatCard, StatusChip, Empty } from '../../components/ui';
import { fdate, fdt } from '../../utils/format';
import { brand } from '../../theme';

const INCIDENT_CATEGORIES = ['Equipment', 'Facility', 'Billing', 'Coach', 'Safety', 'Feedback', 'Other'];
const PRIORITIES = ['Low', 'Normal', 'High'];
const blankIncident = { category: 'Equipment', subject: '', description: '', equipmentId: '', priority: 'Normal' };
const blankInquiry = { subject: '', message: '' };
const OPEN = ['Open', 'In Progress'];

function IncidentDialog({ open, onClose, onSaved }) {
  const toast = useToast();
  const eq = useFetch(open ? '/equipment' : null, { initial: [] });
  const [f, setF] = useState(blankIncident);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { category: f.category, subject: f.subject.trim(), description: f.description.trim(), priority: f.priority };
      if (f.category === 'Equipment' && f.equipmentId) body.equipmentId = f.equipmentId;
      const { data } = await api.post('/incidents', body);
      toast(`Report ${data.reportNo} submitted. Staff will look into it.`);
      setF(blankIncident);
      onSaved();
      onClose();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: submit }}>
      <DialogTitle>Report an incident</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Grid cols={{ xs: 1, sm: 2 }}>
            <TextField select label="Category" value={f.category} onChange={set('category')} required>
              {INCIDENT_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField select label="Priority" value={f.priority} onChange={set('priority')}>
              {PRIORITIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Grid>
          {f.category === 'Equipment' && (
            <TextField select label="Equipment (optional)" value={f.equipmentId} onChange={set('equipmentId')} helperText="Reported equipment is flagged for maintenance.">
              <MenuItem value="">Not sure / not listed</MenuItem>
              {(eq.data || []).map((x) => <MenuItem key={x._id} value={x._id}>{x.equipmentName}{x.code ? ` · ${x.code}` : ''}{x.location ? ` · ${x.location}` : ''}</MenuItem>)}
            </TextField>
          )}
          <TextField label="Subject" value={f.subject} onChange={set('subject')} required inputProps={{ maxLength: 120 }} placeholder="e.g. Treadmill 3 belt slipping" />
          <TextField label="Description" value={f.description} onChange={set('description')} required multiline minRows={4} placeholder="What happened, where and when?" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={busy}>Submit report</Button>
      </DialogActions>
    </Dialog>
  );
}

function InquiryDialog({ open, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(blankInquiry);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/inquiries', { subject: f.subject.trim(), message: f.message.trim() });
      toast(`Request ${data.inquiryNo} sent. We'll get back to you soon.`);
      setF(blankInquiry);
      onSaved();
      onClose();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: submit }}>
      <DialogTitle>Ask for support</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} required inputProps={{ maxLength: 120 }} placeholder="e.g. Question about my membership" />
          <TextField label="Message" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} required multiline minRows={4} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={busy}>Send request</Button>
      </DialogActions>
    </Dialog>
  );
}

function Item({ code, title, status, date, chips, body, reply, replyLabel, replyAt, history }) {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} onClick={() => setOpen(!open)} sx={{ cursor: 'pointer' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>{code} · {fdate(date)}</Typography>
          <Typography variant="body2" fontWeight={800}>{title}</Typography>
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>{chips}</Stack>
        </Box>
        <StatusChip label={status} />
      </Stack>
      {reply ? (
        <Box sx={{ mt: 1.2, p: 1.2, bgcolor: brand.greenSoft, borderRadius: 2 }}>
          <Typography variant="caption" fontWeight={800} sx={{ color: brand.green }}>{replyLabel}{replyAt ? ` · ${fdt(replyAt)}` : ''}</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{reply}</Typography>
        </Box>
      ) : OPEN.includes(status) && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>Waiting for a response from the staff.</Typography>}
      <Collapse in={open}>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.2, whiteSpace: 'pre-wrap' }}>{body || 'No details.'}</Typography>
        {history?.length > 0 && (
          <Stack spacing={0.5} sx={{ mt: 1.2, pl: 1.5, borderLeft: `2px solid ${brand.line}` }}>
            {history.map((h, i) => <Typography key={h._id || i} variant="caption" color="text.secondary">{fdt(h.at)} · {h.status}{h.note ? ` · ${h.note}` : ''}{h.byName ? ` (${h.byName})` : ''}</Typography>)}
          </Stack>
        )}
      </Collapse>
      <Button size="small" onClick={() => setOpen(!open)} sx={{ mt: 0.5, px: 0 }}>{open ? 'Hide details' : 'Show details'}</Button>
    </Box>
  );
}

export default function HelpReports() {
  usePageTitle('Help & Reports', 'Report a problem or ask the gym staff for help.');
  const [tab, setTab] = useState('incidents');
  const [dlg, setDlg] = useState(null);
  const inc = useFetch('/incidents/mine', { initial: [] });
  const inq = useFetch('/inquiries/mine', { initial: [] });
  useSocketEvent('notification', (n) => {
    if (n?.notificationType === 'Incident') inc.reload();
    if (n?.notificationType === 'Inquiry') inq.reload();
  });
  const incidents = inc.data || [];
  const inquiries = inq.data || [];
  const openCount = incidents.filter((x) => OPEN.includes(x.status)).length + inquiries.filter((x) => OPEN.includes(x.status)).length;
  const resolved = incidents.filter((x) => !OPEN.includes(x.status)).length + inquiries.filter((x) => !OPEN.includes(x.status)).length;

  return (
    <Stack spacing={2}>
      <Grid cols={{ xs: 1, md: 2 }}>
        <Card>
          <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: brand.orangeSoft, color: brand.orange, display: 'grid', placeItems: 'center', flex: 'none' }}><ReportProblemOutlined /></Box>
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={800}>Report an incident</Typography>
              <Typography variant="body2" color="text.secondary">Broken equipment, facility issues, safety concerns or feedback.</Typography>
            </Box>
            <Button variant="contained" onClick={() => setDlg('incident')}>Report</Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: brand.blueSoft, color: brand.blue, display: 'grid', placeItems: 'center', flex: 'none' }}><SupportAgentOutlined /></Box>
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={800}>Ask for support</Typography>
              <Typography variant="body2" color="text.secondary">Questions about your account, membership, payments or schedules.</Typography>
            </Box>
            <Button variant="outlined" onClick={() => setDlg('inquiry')}>Ask</Button>
          </CardContent>
        </Card>
      </Grid>
      <Grid cols={{ xs: 1, sm: 3 }}>
        <StatCard label="Incident reports" value={incidents.length} />
        <StatCard label="Support requests" value={inquiries.length} />
        <StatCard label="Awaiting action" value={openCount} sub={`${resolved} resolved or closed`} />
      </Grid>
      <Section>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="incidents" label={`My reports (${incidents.length})`} />
          <Tab value="inquiries" label={`My support requests (${inquiries.length})`} />
        </Tabs>
        {tab === 'incidents' ? (
          <DataState {...inc} onRetry={inc.reload}>
            <Stack spacing={1.5}>
              {incidents.map((x) => (
                <Item key={x._id} code={x.reportNo} title={x.subject} status={x.status} date={x.dateReported} body={x.description}
                  chips={<><StatusChip label={x.category} color="grey" /><StatusChip label={`${x.priority} priority`} color={x.priority === 'High' ? 'red' : x.priority === 'Low' ? 'grey' : 'amber'} /></>}
                  reply={x.resolution} replyLabel="Staff response" replyAt={x.resolvedAt} history={x.history} />
              ))}
              {!incidents.length && <Empty>You haven't submitted any reports.</Empty>}
            </Stack>
          </DataState>
        ) : (
          <DataState {...inq} onRetry={inq.reload}>
            <Stack spacing={1.5}>
              {inquiries.map((x) => (
                <Item key={x._id} code={x.inquiryNo} title={x.subject} status={x.status} date={x.createdAt} body={x.message}
                  chips={<StatusChip label={x.inquiryType} color="blue" />}
                  reply={x.response} replyLabel="Staff response" replyAt={x.respondedAt} />
              ))}
              {!inquiries.length && <Empty>You haven't sent any support requests.</Empty>}
            </Stack>
          </DataState>
        )}
      </Section>
      <IncidentDialog open={dlg === 'incident'} onClose={() => setDlg(null)} onSaved={() => { setTab('incidents'); inc.reload(); }} />
      <InquiryDialog open={dlg === 'inquiry'} onClose={() => setDlg(null)} onSaved={() => { setTab('inquiries'); inq.reload(); }} />
    </Stack>
  );
}
