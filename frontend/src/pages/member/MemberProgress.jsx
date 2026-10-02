import { useState } from 'react';
import { Box, Button, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import EmojiEventsOutlined from '@mui/icons-material/EmojiEventsOutlined';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { usePageTitle } from '../../components/AppShell';
import { Grid, Section, StatCard, Empty, DataState, ConfirmDialog } from '../../components/ui';
import { LineChart } from '../../components/Charts';
import { fdate, fdm, isoDay } from '../../utils/format';
import { brand } from '../../theme';

const blank = () => ({ recordDate: isoDay(), weight: '', bodyFat: '', remarks: '' });

export default function MemberProgress() {
  usePageTitle('Progress', "Track your performance and see how far you've come.");
  const toast = useToast();
  const records = useFetch('/progress/me', { initial: [] });
  const badges = useFetch('/engagement/badges/me');
  const nutrition = useFetch('/engagement/nutrition/me');
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(null);

  const list = records.data || [];
  const withW = list.filter((r) => r.weight != null);
  const first = withW[0];
  const last = withW[withW.length - 1];
  const lastFat = [...list].reverse().find((r) => r.bodyFat != null);
  const change = first && last && first !== last ? Math.round((last.weight - first.weight) * 10) / 10 : null;
  const earned = (badges.data?.badges || []).filter((b) => b.earned).length;

  const reloadAll = () => {
    records.reload();
    badges.reload();
    nutrition.reload();
  };

  const save = async (e) => {
    e.preventDefault();
    if (!f.weight && !f.bodyFat) {
      toast('Enter at least a weight or body fat value.', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/progress/me', {
        recordDate: f.recordDate || undefined,
        weight: f.weight ? Number(f.weight) : undefined,
        bodyFat: f.bodyFat ? Number(f.bodyFat) : undefined,
        remarks: f.remarks || undefined,
      });
      toast('Progress saved');
      setF(blank());
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/progress/${del._id}`);
      toast('Record deleted');
      setDel(null);
      reloadAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  return (
    <Stack spacing={2}>
      <Grid cols={{ xs: 1, sm: 2, lg: 4 }}>
        <StatCard label="Current weight" value={last ? `${last.weight} kg` : '—'} sub={change != null ? `${change > 0 ? '+' : ''}${change} kg since ${fdm(first.recordDate)}` : 'Log your first measurement'} />
        <StatCard label="Body fat" value={lastFat ? `${lastFat.bodyFat}%` : '—'} sub={lastFat ? `as of ${fdate(lastFat.recordDate)}` : 'No record yet'} />
        <StatCard label="BMI" value={nutrition.data?.bmi ?? '—'} sub={nutrition.data?.band || 'Add your height in Profile'} />
        <StatCard label="Visits" value={badges.data?.stats?.visits ?? '—'} sub={badges.data ? `${badges.data.stats.streak}-day streak · ${earned}/${badges.data.badges.length} badges` : ''} />
      </Grid>

      <Grid cols={{ xs: 1, md: '2fr 1fr' }}>
        <Section title="Weight & body fat">
          <DataState {...records} onRetry={records.reload}>
            {list.length > 1 ? (
              <LineChart
                legend
                height={240}
                labels={list.map((r) => fdm(r.recordDate))}
                series={[
                  { label: 'Weight (kg)', data: list.map((r) => r.weight ?? null), color: brand.orange, fill: true },
                  { label: 'Body fat (%)', data: list.map((r) => r.bodyFat ?? null), color: brand.yellow },
                ]}
              />
            ) : (
              <Empty>Log at least two measurements to see your trend.</Empty>
            )}
          </DataState>
        </Section>
        <Section title="Log a measurement">
          <Stack component="form" spacing={2} onSubmit={save}>
            <TextField label="Date" type="date" value={f.recordDate} onChange={(e) => setF({ ...f, recordDate: e.target.value })} InputLabelProps={{ shrink: true }} inputProps={{ max: isoDay() }} />
            <TextField label="Weight (kg)" type="number" inputProps={{ step: 0.1, min: 20, max: 400 }} value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} />
            <TextField label="Body fat (%)" type="number" inputProps={{ step: 0.1, min: 2, max: 70 }} value={f.bodyFat} onChange={(e) => setF({ ...f, bodyFat: e.target.value })} />
            <TextField label="Remarks" placeholder="e.g. Squat 5x5 at 80 kg" value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} multiline minRows={2} />
            <Button type="submit" variant="contained" disabled={saving}>Save record</Button>
          </Stack>
        </Section>
      </Grid>

      <Grid cols={{ xs: 1, md: 2 }}>
        <Section title="Achievements">
          <DataState {...badges} onRetry={badges.reload}>
            <Grid cols={{ xs: 1, sm: 2 }} gap={1.5}>
              {(badges.data?.badges || []).map((b) => (
                <Stack key={b.key} direction="row" spacing={1.5} alignItems="center" sx={{ opacity: b.earned ? 1 : 0.45 }}>
                  <Box sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: b.earned ? brand.yellow : brand.fill, color: b.earned ? '#fff' : brand.ink2, display: 'grid', placeItems: 'center', flex: 'none' }}>
                    <EmojiEventsOutlined fontSize="small" />
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={700}>{b.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{b.earned ? `Earned ${fdate(b.earnedAt)}` : b.rule}</Typography>
                  </Box>
                </Stack>
              ))}
            </Grid>
          </DataState>
        </Section>
        <Section title={`Nutrition tips${nutrition.data?.goal ? ` for ${nutrition.data.goal}` : ''}`}>
          <DataState {...nutrition} onRetry={nutrition.reload}>
            {nutrition.data?.bmi != null && (
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                Based on your latest BMI of <b>{nutrition.data.bmi}</b> ({nutrition.data.band}) and your goal.
              </Typography>
            )}
            {nutrition.data?.rules?.length ? (
              nutrition.data.rules.map((r) => (
                <Box key={r.title} sx={{ mb: 1.5 }}>
                  <Typography variant="body2" fontWeight={700}>{r.title}</Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                    {(r.tips || []).map((t) => <Typography component="li" variant="body2" key={t}>{t}</Typography>)}
                  </Box>
                </Box>
              ))
            ) : (
              <Empty>No tips for your goal yet.</Empty>
            )}
            <Typography variant="caption" color="text.secondary">{nutrition.data?.disclaimer}</Typography>
          </DataState>
        </Section>
      </Grid>

      <Section title="History">
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Weight</TableCell>
                <TableCell>Body fat</TableCell>
                <TableCell>BMI</TableCell>
                <TableCell>Logged by</TableCell>
                <TableCell>Remarks</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {[...list].reverse().map((r) => (
                <TableRow key={r._id}>
                  <TableCell>{fdate(r.recordDate)}</TableCell>
                  <TableCell>{r.weight != null ? `${r.weight} kg` : '—'}</TableCell>
                  <TableCell>{r.bodyFat != null ? `${r.bodyFat}%` : '—'}</TableCell>
                  <TableCell>{r.bmi ?? '—'}</TableCell>
                  <TableCell>{r.recordedByType === 'Member' ? 'You' : r.coach ? `Coach ${r.coach.firstName}` : 'Staff'}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{r.remarks || '—'}</TableCell>
                  <TableCell align="right">
                    {r.recordedByType === 'Member' && (
                      <IconButton size="small" aria-label="Delete record" onClick={() => setDel(r)}><DeleteOutline fontSize="small" /></IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!list.length && <Empty>No records yet.</Empty>}
        </Box>
      </Section>

      <ConfirmDialog open={!!del} title="Delete record?" message={del ? `Remove your ${fdate(del.recordDate)} record?` : ''} confirmLabel="Delete" danger onClose={() => setDel(null)} onConfirm={remove} />
    </Stack>
  );
}
