import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Button, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Grid, Section, StatCard, StatusChip, UserAvatar, Empty, ConfirmDialog } from '../../components/ui';
import { LineChart } from '../../components/Charts';
import { fdate, fdm, isoDay } from '../../utils/format';
import { brand } from '../../theme';

const blank = () => ({ recordDate: isoDay(), weight: '', bodyFat: '', remarks: '' });
const by = (x) => (x.coach ? `Coach ${x.coach.firstName}` : x.recordedByType === 'Member' ? 'Self-logged' : x.recordedByType === 'StaffAdmin' ? 'Staff' : '—');

export default function CoachClientProgress() {
  usePageTitle('Client Progress', "Track and monitor your clients' fitness journey and progress.");
  const toast = useToast();
  const { account } = useAuth();
  const [params, setParams] = useSearchParams();
  const clients = useFetch('/coaches/me/clients', { initial: [] });
  const [sel, setSel] = useState(params.get('member') || '');
  const pr = useFetch(sel ? `/progress/member/${sel}` : null, { initial: [] });
  const [f, setF] = useState(blank());
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(null);

  useEffect(() => {
    if (!sel && clients.data?.length) setSel(clients.data[0]._id);
  }, [clients.data, sel]);

  const member = (clients.data || []).find((c) => String(c._id) === String(sel));
  const recs = pr.data || [];
  const w = recs.filter((x) => x.weight != null);
  const bf = recs.filter((x) => x.bodyFat != null);
  const first = w[0];
  const last = w[w.length - 1];
  const lastBmi = [...recs].reverse().find((x) => x.bmi != null);

  const choose = (id) => {
    setSel(id);
    setParams({ member: id });
  };
  const save = async (e) => {
    e.preventDefault();
    if (f.weight === '' && f.bodyFat === '') return toast('Enter at least a weight or body fat value.', 'error');
    setBusy(true);
    try {
      await api.post(`/progress/member/${sel}`, {
        recordDate: f.recordDate ? new Date(`${f.recordDate}T12:00:00`).toISOString() : undefined,
        weight: f.weight === '' ? undefined : Number(f.weight),
        bodyFat: f.bodyFat === '' ? undefined : Number(f.bodyFat),
        remarks: f.remarks || undefined,
      });
      toast('Assessment saved and shared with the client');
      setF(blank());
      pr.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      await api.delete(`/progress/${del._id}`);
      toast('Record deleted');
      setDel(null);
      pr.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  return (
    <Stack spacing={2}>
      <Section>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
          {member ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <UserAvatar name={member.name} src={member.avatarUrl} size={44} />
              <Box>
                <Typography fontWeight={800}>{member.name}</Typography>
                <Typography variant="caption" color="text.secondary">{member.memberCode} · Goal: {member.fitnessGoal || '—'} · {member.heightCm ? `${member.heightCm} cm` : 'height not set'}</Typography>
              </Box>
              <StatusChip label={member.status} />
            </Stack>
          ) : <Typography color="text.secondary">Choose a client</Typography>}
          <TextField select label="Client" value={member ? sel : ''} onChange={(e) => choose(e.target.value)} sx={{ width: { sm: 280 } }} fullWidth={false} disabled={!clients.data?.length}>
            {(clients.data || []).map((c) => <MenuItem key={c._id} value={c._id}>{c.name} · {c.memberCode}</MenuItem>)}
          </TextField>
        </Stack>
      </Section>
      {!clients.loading && !clients.data?.length && <Empty>No clients yet. Members appear here once they enroll in your programs or choose you as their coach.</Empty>}
      {sel && member && (
        <DataState {...pr} onRetry={pr.reload}>
          <Stack spacing={2}>
            <Grid cols={{ xs: 1, sm: 2, lg: 4 }}>
              <StatCard label="Current weight" value={last ? `${last.weight} kg` : '—'} sub={first && last && first !== last ? `${(last.weight - first.weight > 0 ? '+' : '')}${(last.weight - first.weight).toFixed(1)} kg since ${fdm(first.recordDate)}` : 'No change yet'} />
              <StatCard label="Body fat" value={bf.length ? `${bf[bf.length - 1].bodyFat}%` : '—'} />
              <StatCard label="BMI" value={lastBmi?.bmi ?? '—'} sub={member.heightCm ? '' : 'Needs height on profile'} />
              <StatCard label="Total visits" value={member.totalVisits ?? 0} sub={`${member.visits30} in the last 30 days`} />
            </Grid>
            <Grid cols={{ xs: 1, md: '2fr 1fr' }}>
              <Section title="Trend">
                {recs.length > 1 ? (
                  <LineChart legend height={240} labels={recs.map((x) => fdm(x.recordDate))} series={[
                    { label: 'Weight (kg)', data: recs.map((x) => x.weight ?? null), color: brand.orange, fill: true },
                    { label: 'Body fat (%)', data: recs.map((x) => x.bodyFat ?? null), color: brand.yellow },
                  ]} />
                ) : <Empty>At least two records are needed to show a trend.</Empty>}
              </Section>
              <Section title="Add assessment">
                <Stack component="form" spacing={2} onSubmit={save}>
                  <TextField type="date" label="Date" value={f.recordDate} onChange={(e) => setF({ ...f, recordDate: e.target.value })} InputLabelProps={{ shrink: true }} />
                  <TextField label="Weight (kg)" type="number" inputProps={{ step: 0.1, min: 20, max: 400 }} value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} />
                  <TextField label="Body fat (%)" type="number" inputProps={{ step: 0.1, min: 2, max: 70 }} value={f.bodyFat} onChange={(e) => setF({ ...f, bodyFat: e.target.value })} />
                  <TextField label="Remarks" multiline minRows={2} value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} placeholder="Form notes, next targets…" />
                  <Button type="submit" variant="contained" disabled={busy}>Save assessment</Button>
                </Stack>
              </Section>
            </Grid>
            <Section title="History">
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Weight</TableCell><TableCell>Body fat</TableCell><TableCell>BMI</TableCell><TableCell>Remarks</TableCell><TableCell>Recorded by</TableCell><TableCell /></TableRow></TableHead>
                  <TableBody>
                    {[...recs].reverse().map((x) => (
                      <TableRow key={x._id}>
                        <TableCell>{fdate(x.recordDate)}</TableCell>
                        <TableCell>{x.weight != null ? `${x.weight} kg` : '—'}</TableCell>
                        <TableCell>{x.bodyFat != null ? `${x.bodyFat}%` : '—'}</TableCell>
                        <TableCell>{x.bmi ?? '—'}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{x.remarks || '—'}</TableCell>
                        <TableCell>{by(x)}</TableCell>
                        <TableCell align="right">{String(x.recordedBy) === String(account?._id) && <IconButton size="small" aria-label="Delete record" onClick={() => setDel(x)}><DeleteOutline fontSize="small" /></IconButton>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!recs.length && <Empty>No records yet. Add the first assessment.</Empty>}
              </Box>
            </Section>
          </Stack>
        </DataState>
      )}
      <ConfirmDialog open={!!del} title="Delete this record?" message="This cannot be undone." confirmLabel="Delete" danger onClose={() => setDel(null)} onConfirm={remove} />
    </Stack>
  );
}
