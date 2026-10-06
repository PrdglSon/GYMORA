import { useEffect, useState } from 'react';
import { Autocomplete, Box, Button, MenuItem, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import dayjs from 'dayjs';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../context/SocketContext';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Grid, Section, StatCard, StatusChip, Empty } from '../../components/ui';
import { LineChart, BarChart, DonutChart } from '../../components/Charts';
import { ftime, peso, hourLabel, isoDay } from '../../utils/format';
import { brand } from '../../theme';
import { NameField, PhoneField } from '../../components/ContactFields';

const CHECKIN_METHODS = ['QR Kiosk', 'Front Desk'];
const PAY_METHODS = ['Cash', 'GCash', 'Card', 'Other', 'Unpaid'];

function MemberPicker({ onPick }) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState([]);
  const [value, setValue] = useState(null);
  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.length < 2) return setOpts([]);
      try {
        const { data } = await api.get('/members', { params: { q, limit: 10 } });
        setOpts(data.items);
      } catch {
        setOpts([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <Autocomplete
      options={opts}
      value={value}
      filterOptions={(x) => x}
      isOptionEqualToValue={(a, b) => a._id === b._id}
      getOptionLabel={(m) => `${m.memberCode} · ${m.name}`}
      onInputChange={(_, v, reason) => reason !== 'reset' && setQ(v)}
      onChange={(_, v) => {
        if (v) onPick(v);
        setValue(null);
        setQ('');
      }}
      renderOption={(props, m) => {
        const { key, ...rest } = props;
        return (
          <li key={m._id} {...rest}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
              <Box sx={{ flex: 1 }}><Typography variant="body2" fontWeight={700}>{m.name}</Typography><Typography variant="caption" color="text.secondary">{m.memberCode} · {m.phoneNumber}</Typography></Box>
              <StatusChip label={m.status} />
            </Stack>
          </li>
        );
      }}
      renderInput={(p) => <TextField {...p} label="Find member (name, ID or phone)" size="small" />}
      noOptionsText={q.length < 2 ? 'Type at least 2 letters' : 'No match'}
    />
  );
}

export default function Attendance() {
  usePageTitle('Attendance', 'Monitor member check-ins, walk-ins and attendance activity.');
  const { gym } = useAuth();
  const toast = useToast();
  const [date, setDate] = useState(isoDay());
  const [type, setType] = useState('');
  const [method, setMethod] = useState('');
  const [q, setQ] = useState('');
  const list = useFetch('/attendance', { params: { date, attendeeType: type || undefined, method: method || undefined, q: q || undefined }, initial: [] });
  const stats = useFetch('/attendance/stats');
  const emptyWalk = { fullName: '', phoneNumber: '', email: '', method: 'Cash', referenceNumber: '' };
  const [walk, setWalk] = useState(emptyWalk);
  const [busy, setBusy] = useState(false);
  const reload = () => {
    list.reload();
    stats.reload();
  };
  useSocketEvent('attendance:update', reload);

  const kioskUrl = gym?.slug ? `${window.location.origin}/kiosk/${gym.slug}` : '';
  const checkIn = async (m) => {
    try {
      const { data } = await api.post(`/members/${m._id}/checkin`);
      toast(`${data.title} ${data.message}`, data.ok ? 'success' : 'error');
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };
  const addWalkin = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/attendance/walkin', { ...walk, phoneNumber: walk.phoneNumber || undefined, email: walk.email || undefined, referenceNumber: walk.referenceNumber || undefined });
      toast(`${data.guest.fullName} checked in. ${data.payment.status === 'Paid' ? `Collected ${peso(data.payment.amount)}` : 'Payment pending'} (${data.payment.receiptNo})`);
      setWalk(emptyWalk);
      reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const checkout = async (a) => {
    try {
      await api.patch(`/attendance/${a._id}/checkout`);
      toast(`${a.name} checked out`);
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(kioskUrl);
      toast('Kiosk link copied');
    } catch {
      toast('Copy failed. Select the link and copy it manually.', 'error');
    }
  };

  const s = stats.data;
  const hours = Array.from({ length: 17 }, (_, i) => i + 6);
  const now = new Date();
  return (
    <Stack spacing={2}>
      <Grid cols={{ xs: 1, sm: 3, lg: 5 }}>
        <StatCard label="Members checked in" value={s?.today.members ?? '—'} delta={s && [s.today.members, s.yesterday.members]} />
        <StatCard label="Walk-in guests" value={s?.today.walkins ?? '—'} delta={s && [s.today.walkins, s.yesterday.walkins]} />
        <StatCard label="Total check-ins" value={s?.today.total ?? '—'} delta={s && [s.today.total, s.yesterday.total]} />
        <StatCard label="Active now" value={s?.today.activeNow ?? '—'} sub="currently in the gym" subColor={brand.green} />
        <StatCard label="Attendance rate" value={s ? `${s.attendanceRate}%` : '—'} sub="of current members today" subColor={brand.yellowInk} />
      </Grid>
      <Grid cols={{ xs: 1, md: 3 }}>
        <Section title="Front desk check-in / check-out">
          <MemberPicker onPick={checkIn} />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>Picking a member who is already in checks them out. Expired memberships are blocked (grace period: {gym?.settings?.graceDays ?? 3} days).</Typography>
        </Section>
        <Section title="Register walk-in guest">
          <Stack component="form" spacing={1.5} onSubmit={addWalkin}>
            <Grid cols={{ xs: 1, sm: 2 }} gap={1.5}>
              <NameField size="small" label="Guest name" value={walk.fullName} onChange={(e) => setWalk({ ...walk, fullName: e.target.value })} required />
              <PhoneField size="small" label="Phone number" value={walk.phoneNumber} onChange={(e) => setWalk({ ...walk, phoneNumber: e.target.value })} />
              <TextField size="small" select label="Payment" value={walk.method} onChange={(e) => setWalk({ ...walk, method: e.target.value })}>{PAY_METHODS.map((m) => <MenuItem key={m} value={m}>{m === 'Unpaid' ? 'Collect later' : m}</MenuItem>)}</TextField>
              {['GCash', 'Card', 'Other'].includes(walk.method) ? <TextField size="small" label="Reference number" value={walk.referenceNumber} onChange={(e) => setWalk({ ...walk, referenceNumber: e.target.value })} /> : <TextField size="small" label="Email (optional)" type="email" value={walk.email} onChange={(e) => setWalk({ ...walk, email: e.target.value })} />}
            </Grid>
            <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="body2">Day pass: <b>{peso(gym?.settings?.walkInFee)}</b></Typography><Button type="submit" variant="contained" disabled={busy}>Check in guest</Button></Stack>
          </Stack>
        </Section>
        <Section title="QR kiosk">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Open this page on the front-desk tablet. Members scan their QR code to tap in and out.</Typography>
          <Box sx={{ p: 1.2, bgcolor: brand.fill, borderRadius: 2, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all', mb: 1 }}>{kioskUrl || 'Gym link unavailable'}</Box>
          {gym?.settings?.kioskKey && <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>Kiosk unlock key: <b>{gym.settings.kioskKey}</b></Typography>}
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="contained" startIcon={<OpenInNewIcon />} disabled={!kioskUrl} component="a" href={kioskUrl} target="_blank" rel="noreferrer">Open kiosk</Button>
            <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />} disabled={!kioskUrl} onClick={copy}>Copy link</Button>
          </Stack>
        </Section>
      </Grid>
      {s && (
        <Grid cols={{ xs: 1, md: 3 }}>
          <Section title="Attendance overview (7 days)">
            <LineChart legend height={200} labels={s.week.map((w) => dayjs(w.date).format('MMM D'))} series={[{ label: 'Members', data: s.week.map((w) => w.members), color: brand.blue }, { label: 'Walk-ins', data: s.week.map((w) => w.walkins), color: brand.green }, { label: 'Total', data: s.week.map((w) => w.members + w.walkins), color: brand.purple }]} />
          </Section>
          <Section title="Check-in methods (today)">
            <DonutChart center={s.today.total} sub="Check-ins" segments={[{ label: 'QR Kiosk', value: s.methods['QR Kiosk'] || 0, color: brand.green }, { label: 'Front Desk', value: s.methods['Front Desk'] || 0, color: brand.orange }]} />
          </Section>
          <Section title="Today's peak hours">
            <BarChart height={200} labels={hours.map(hourLabel)} data={hours.map((h) => s.hourly[h])} highlight={hours.map((h) => s.hourly[h]).indexOf(Math.max(...hours.map((h) => s.hourly[h])))} label="Check-ins" />
          </Section>
        </Grid>
      )}
      <Section>
        <Tabs value={type} onChange={(_, v) => setType(v)} sx={{ mb: 1.5 }}><Tab value="" label="All check-ins" /><Tab value="Member" label="Members" /><Tab value="Walk-in" label="Walk-in guests" /></Tabs>
        <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
          <TextField size="small" placeholder="Search name…" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: 220 }} inputProps={{ 'aria-label': 'Search name' }} />
          <TextField size="small" select value={method} onChange={(e) => setMethod(e.target.value)} sx={{ width: 180 }} SelectProps={{ displayEmpty: true }} inputProps={{ 'aria-label': 'Method' }}>
            <MenuItem value="">All methods</MenuItem>{CHECKIN_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
          <TextField size="small" type="date" value={date} onChange={(e) => setDate(e.target.value || isoDay())} sx={{ width: 170 }} inputProps={{ 'aria-label': 'Date' }} />
        </Stack>
        <DataState {...list} onRetry={list.reload}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Type</TableCell><TableCell>Time in</TableCell><TableCell>Time out</TableCell><TableCell>Duration</TableCell><TableCell>Method</TableCell><TableCell>Payment</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {list.data?.map((a) => {
                  const mins = Math.max(0, Math.round(((a.timeOut ? new Date(a.timeOut) : now) - new Date(a.timeIn)) / 60000));
                  return (
                    <TableRow key={a._id}>
                      <TableCell><b>{a.name}</b> {a.member?.memberCode && <Typography component="span" variant="caption" color="text.secondary">{a.member.memberCode}</Typography>}</TableCell>
                      <TableCell><StatusChip label={a.attendeeType} color={a.attendeeType === 'Member' ? 'blue' : 'amber'} /></TableCell>
                      <TableCell>{ftime(a.timeIn)}</TableCell>
                      <TableCell>{a.timeOut ? ftime(a.timeOut) : <StatusChip label="In gym" />}</TableCell>
                      <TableCell>{Math.floor(mins / 60)}h {mins % 60}m</TableCell>
                      <TableCell><StatusChip label={a.method} color={a.method === 'Front Desk' ? 'grey' : undefined} /></TableCell>
                      <TableCell>{a.payment ? <Stack direction="row" spacing={0.5} alignItems="center"><StatusChip label={a.payment.status} /><Typography variant="caption" color="text.secondary">{a.payment.receiptNo}</Typography></Stack> : '—'}</TableCell>
                      <TableCell>{a.status === 'Auto Checked Out' ? <StatusChip label={a.status} /> : !a.timeOut && <Button size="small" variant="outlined" onClick={() => checkout(a)}>Check out</Button>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {!list.data?.length && <Empty>No check-ins match.</Empty>}
          </Box>
        </DataState>
      </Section>
    </Stack>
  );
}
