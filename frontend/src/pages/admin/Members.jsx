import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, FormControlLabel, IconButton, MenuItem, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import dayjs from 'dayjs';
import api, { errMsg, fileUrl } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../context/SocketContext';
import { usePageTitle } from '../../components/AppShell';
import { ConfirmDialog, DataState, Grid, Section, StatCard, StatusChip, UserAvatar, Empty } from '../../components/ui';
import { fdate, fdm, fdt, peso, peso0 } from '../../utils/format';
import { brand } from '../../theme';

const GOALS = ['Weight Loss', 'Muscle Gain', 'Strength', 'General Fitness', 'Endurance', 'Flexibility'];
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const STATUSES = ['All', 'Active', 'Near Expiry', 'Expired', 'Pending', 'Student pending'];
const METHODS = ['Cash', 'GCash', 'Card', 'Other', 'Unpaid'];
const methodLabel = (m) => (m === 'Unpaid' ? 'Collect later (unpaid)' : m);
const STUDENT_COLOR = { verified: 'green', pending: 'amber', rejected: 'red' };

function AddMemberDialog({ open, onClose, plans, onSaved }) {
  const toast = useToast();
  const empty = { firstName: '', lastName: '', email: '', phoneNumber: '', gender: 'Prefer not to say', birthdate: '', fitnessGoal: 'General Fitness', heightCm: '', address: '', emergencyContact: '', password: '', planId: '', method: 'Cash', referenceNumber: '', isStudent: false, school: '' };
  const [f, setF] = useState(empty);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const active = plans.filter((p) => p.status === 'Active');
  useEffect(() => {
    if (open) {
      setF({ ...empty, planId: active.find((p) => !p.isStudentPlan)?._id || '' });
      setResult(null);
    }
  }, [open]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const lock = useRef(false);
  const submit = async (e) => {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const body = { ...f, password: f.password || undefined, heightCm: f.heightCm || undefined, birthdate: f.birthdate || undefined, planId: f.planId || undefined, method: f.planId ? f.method : undefined, referenceNumber: f.referenceNumber || undefined };
      const { data } = await api.post('/members', body);
      setResult(data);
      onSaved();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: submit }}>
      <DialogTitle>Add member</DialogTitle>
      <DialogContent>
        {result ? (
          <Alert severity="success" sx={{ mt: 1 }}>
            <b>{result.member.name}</b> is registered as <b>{result.member.memberCode}</b>.
            {result.temporaryPassword ? <> Temporary password: <b>{result.temporaryPassword}</b>. Give it to the member; they log in with {result.member.email}.</> : <> They log in with {result.member.email} and the password you set.</>}
            {result.payment && <> Receipt {result.payment.receiptNo}: {peso(result.payment.amount)} ({result.payment.status}).</>}
          </Alert>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Grid cols={{ xs: 1, sm: 2 }}>
              <TextField label="First name" value={f.firstName} onChange={set('firstName')} required />
              <TextField label="Last name" value={f.lastName} onChange={set('lastName')} required />
              <TextField label="Email" type="email" value={f.email} onChange={set('email')} required />
              <TextField label="Phone number" value={f.phoneNumber} onChange={set('phoneNumber')} required />
              <TextField select label="Gender" value={f.gender} onChange={set('gender')}>{GENDERS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}</TextField>
              <TextField label="Birthdate" type="date" value={f.birthdate} onChange={set('birthdate')} InputLabelProps={{ shrink: true }} />
              <TextField select label="Fitness goal" value={f.fitnessGoal} onChange={set('fitnessGoal')}>{GOALS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}</TextField>
              <TextField label="Height (cm)" type="number" value={f.heightCm} onChange={set('heightCm')} inputProps={{ min: 100, max: 250 }} />
              <TextField label="Address" value={f.address} onChange={set('address')} />
              <TextField label="Emergency contact" value={f.emergencyContact} onChange={set('emergencyContact')} />
              <TextField label="Login password (optional)" type="text" value={f.password} onChange={set('password')} inputProps={{ minLength: 8 }} helperText="Leave blank to create a temporary one" autoComplete="new-password" />
            </Grid>
            <FormControlLabel control={<Checkbox checked={f.isStudent} onChange={(e) => setF({ ...f, isStudent: e.target.checked })} />} label="Student (school ID checked at the desk)" />
            {f.isStudent && <TextField label="School" value={f.school} onChange={set('school')} />}
            <Divider />
            <Grid cols={{ xs: 1, sm: 2 }}>
              <TextField select label="Membership plan" value={f.planId} onChange={set('planId')}>
                <MenuItem value="">No plan yet</MenuItem>
                {active.map((p) => <MenuItem key={p._id} value={p._id} disabled={p.isStudentPlan && !f.isStudent}>{p.planName} · {p.duration} days · {peso0(p.price)}</MenuItem>)}
              </TextField>
              {f.planId && <TextField select label="Payment" value={f.method} onChange={set('method')}>{METHODS.map((m) => <MenuItem key={m} value={m}>{methodLabel(m)}</MenuItem>)}</TextField>}
              {f.planId && ['GCash', 'Card', 'Other'].includes(f.method) && <TextField label="Reference number" value={f.referenceNumber} onChange={set('referenceNumber')} />}
            </Grid>
            <Typography variant="caption" color="text.secondary">The member logs in at the Member login with this email. Their login details are emailed to them.</Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onClose}>{result ? 'Done' : 'Cancel'}</Button>
        {!result && <Button type="submit" variant="contained" disabled={busy}>Register member</Button>}
      </DialogActions>
    </Dialog>
  );
}

function MemberDrawer({ id, onClose, plans, coaches, onChanged }) {
  const { role } = useAuth();
  const toast = useToast();
  const d = useFetch(id ? `/members/${id}` : null);
  const [tab, setTab] = useState(0);
  const [renew, setRenew] = useState({ planId: '', method: 'Cash', referenceNumber: '' });
  const [edit, setEdit] = useState(null);
  const [temp, setTemp] = useState('');
  const [busy, setBusy] = useState(false);
  const active = plans.filter((p) => p.status === 'Active');
  useEffect(() => {
    setTab(0);
    setTemp('');
  }, [id]);
  useEffect(() => {
    if (d.data) {
      const m = d.data.member;
      setRenew((r) => ({ ...r, planId: active.find((p) => String(p._id) === String(m.current?.plan))?._id || active.find((p) => !p.isStudentPlan)?._id || '' }));
      setEdit({ firstName: m.firstName || '', lastName: m.lastName || '', email: m.email || '', phoneNumber: m.phoneNumber || '', gender: m.gender || 'Prefer not to say', birthdate: m.birthdate ? dayjs(m.birthdate).format('YYYY-MM-DD') : '', fitnessGoal: m.fitnessGoal || 'General Fitness', heightCm: m.heightCm || '', address: m.address || '', emergencyContact: m.emergencyContact || '', assignedCoach: m.assignedCoach || '' });
    }
  }, [d.data, plans]);

  const [dup, setDup] = useState('');
  const lock = useRef(false);
  const run = async (fn, msg, onError) => {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    try {
      const r = await fn();
      if (msg) toast(typeof msg === 'function' ? msg(r) : msg);
      d.reload();
      onChanged();
      return r;
    } catch (err) {
      if (!onError || !onError(err)) toast(errMsg(err), 'error');
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const sell = (allowDuplicate = false) => run(
    () => api.post(`/members/${id}/memberships`, { ...renew, referenceNumber: renew.referenceNumber || undefined, allowDuplicate }),
    renew.method === 'Unpaid' ? 'Invoice created' : 'Membership sold and payment recorded',
    (err) => {
      const det = err?.response?.data?.details;
      if (err?.response?.status === 409 && det?.duplicate && !det.blocked) {
        setDup(errMsg(err));
        return true;
      }
      return false;
    }
  );
  const checkin = async () => {
    const r = await run(() => api.post(`/members/${id}/checkin`));
    if (r) toast(`${r.data.title} ${r.data.message}`, r.data.ok ? 'success' : 'error');
  };
  const m = d.data?.member;
  const last = d.data?.visits?.[0];
  const inGym = last && !last.timeOut && dayjs(last.timeIn).isSame(dayjs(), 'day');
  const coachName = coaches.find((c) => String(c._id) === String(m?.assignedCoach))?.name;
  const sE = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });

  return (
    <Drawer anchor="right" open={!!id} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', md: 720 } } }}>
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <DataState {...d} onRetry={d.reload}>
          {m && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <UserAvatar name={m.name} src={m.avatarUrl} size={56} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h5">{m.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{m.memberCode} · {m.email} · {m.phoneNumber}</Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                    <StatusChip label={m.status} />
                    {m.student?.status && m.student.status !== 'none' && <StatusChip label={`Student: ${m.student.status}`} color={STUDENT_COLOR[m.student.status]} />}
                    {m.accountStatus === 'inactive' && <StatusChip label="Account inactive" color="red" />}
                    {inGym && <StatusChip label="In gym" />}
                  </Stack>
                </Box>
                <IconButton onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button variant="contained" color={inGym ? 'secondary' : 'primary'} onClick={checkin} disabled={busy}>{inGym ? 'Check out' : 'Check in now'}</Button>
              </Stack>
              <Grid cols={{ xs: 1, sm: 3 }}>
                <StatCard label="Plan" value={<Box component="span" sx={{ fontSize: 16 }}>{m.current?.planName || 'None'}</Box>} sub={m.current?.endDate ? `until ${fdate(m.current.endDate)}${m.daysLeft != null ? ` · ${m.daysLeft} days left` : ''}` : 'not paid yet'} />
                <StatCard label="Total visits" value={m.totalVisits || 0} sub={m.lastVisitAt ? `last ${fdm(m.lastVisitAt)}` : 'no visits yet'} />
                <StatCard label="Goal" value={<Box component="span" sx={{ fontSize: 16 }}>{m.fitnessGoal}</Box>} sub={coachName ? `Coach ${coachName}` : 'No coach'} />
              </Grid>
              {m.student?.status === 'pending' && (
                <Alert severity="info" action={<Stack direction="row" spacing={1}>
                  <Button size="small" variant="contained" disabled={busy} onClick={() => run(() => api.post(`/members/${id}/student-review`, { decision: 'verified' }), 'Student ID approved')}>Approve</Button>
                  <Button size="small" variant="outlined" disabled={busy} onClick={() => run(() => api.post(`/members/${id}/student-review`, { decision: 'rejected', note: 'Please upload a clear, valid school ID.' }), 'Student ID rejected')}>Reject</Button>
                </Stack>}>
                  School ID submitted{m.student.school ? ` (${m.student.school})` : ''}. {m.student.idDocumentUrl && <a href={fileUrl(m.student.idDocumentUrl)} target="_blank" rel="noreferrer">Open the uploaded ID</a>}
                </Alert>
              )}
              <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
                <Tab label="Membership" /><Tab label="Details" /><Tab label="Payments" /><Tab label="Visits" /><Tab label="Programs" />
              </Tabs>
              {tab === 0 && (
                <Stack spacing={2}>
                  <Stack component="form" spacing={2} onSubmit={(e) => { e.preventDefault(); sell(); }}>
                    <Grid cols={{ xs: 1, sm: 3 }}>
                      <TextField select label="Plan" value={renew.planId} onChange={(e) => setRenew({ ...renew, planId: e.target.value })} required>
                        {active.map((p) => <MenuItem key={p._id} value={p._id} disabled={p.isStudentPlan && m.student?.status !== 'verified'}>{p.planName} · {p.duration}d · {peso0(p.price)}</MenuItem>)}
                      </TextField>
                      <TextField select label="Payment" value={renew.method} onChange={(e) => setRenew({ ...renew, method: e.target.value })}>{METHODS.map((x) => <MenuItem key={x} value={x}>{methodLabel(x)}</MenuItem>)}</TextField>
                      <TextField label="Reference number" value={renew.referenceNumber} onChange={(e) => setRenew({ ...renew, referenceNumber: e.target.value })} disabled={!['GCash', 'Card', 'Other'].includes(renew.method)} />
                    </Grid>
                    <Typography variant="caption" color="text.secondary">If the current plan is still valid, the new period starts the day after it ends.</Typography>
                    <Button type="submit" variant="contained" disabled={busy || !renew.planId} sx={{ alignSelf: 'flex-start' }}>{m.current?.endDate ? 'Renew membership' : 'Sell membership'}</Button>
                  </Stack>
                  <Box sx={{ overflowX: 'auto' }}>
                    <Table size="small"><TableHead><TableRow><TableCell>Plan</TableCell><TableCell>Start</TableCell><TableCell>End</TableCell><TableCell align="right">Price</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                      <TableBody>{d.data.memberships.map((x) => <TableRow key={x._id}><TableCell>{x.planName}</TableCell><TableCell>{fdate(x.startDate)}</TableCell><TableCell>{fdate(x.endDate)}</TableCell><TableCell align="right">{peso(x.price)}</TableCell><TableCell><StatusChip label={x.status} /></TableCell></TableRow>)}</TableBody></Table>
                    {!d.data.memberships.length && <Empty>No memberships yet.</Empty>}
                  </Box>
                </Stack>
              )}
              {tab === 1 && edit && (
                <Stack component="form" spacing={2} onSubmit={(e) => { e.preventDefault(); run(() => api.patch(`/members/${id}`, { ...edit, heightCm: edit.heightCm || undefined, birthdate: edit.birthdate || undefined, assignedCoach: edit.assignedCoach || null }), 'Member updated'); }}>
                  <Grid cols={{ xs: 1, sm: 2 }}>
                    <TextField label="First name" value={edit.firstName} onChange={sE('firstName')} required />
                    <TextField label="Last name" value={edit.lastName} onChange={sE('lastName')} required />
                    <TextField label="Email" type="email" value={edit.email} onChange={sE('email')} required />
                    <TextField label="Phone number" value={edit.phoneNumber} onChange={sE('phoneNumber')} />
                    <TextField select label="Gender" value={edit.gender} onChange={sE('gender')}>{GENDERS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}</TextField>
                    <TextField label="Birthdate" type="date" value={edit.birthdate} onChange={sE('birthdate')} InputLabelProps={{ shrink: true }} />
                    <TextField select label="Fitness goal" value={edit.fitnessGoal} onChange={sE('fitnessGoal')}>{GOALS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}</TextField>
                    <TextField label="Height (cm)" type="number" value={edit.heightCm} onChange={sE('heightCm')} inputProps={{ min: 100, max: 250 }} />
                    <TextField select label="Assigned coach" value={edit.assignedCoach} onChange={sE('assignedCoach')}><MenuItem value="">None</MenuItem>{coaches.map((c) => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}</TextField>
                    <TextField label="Emergency contact" value={edit.emergencyContact} onChange={sE('emergencyContact')} />
                  </Grid>
                  <TextField label="Address" value={edit.address} onChange={sE('address')} />
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button type="submit" variant="contained" disabled={busy}>Save details</Button>
                    {role === 'admin' && <Button variant="outlined" disabled={busy} onClick={async () => { const r = await run(() => api.post(`/members/${id}/reset-password`)); if (r) setTemp(r.data.temporaryPassword); }}>Reset password</Button>}
                    <Button variant="outlined" color="error" disabled={busy} onClick={() => run(() => api.patch(`/members/${id}`, { accountStatus: m.accountStatus === 'inactive' ? 'active' : 'inactive' }), m.accountStatus === 'inactive' ? 'Account reactivated' : 'Account deactivated')}>{m.accountStatus === 'inactive' ? 'Reactivate account' : 'Deactivate account'}</Button>
                  </Stack>
                  {temp && <Alert severity="success">Temporary password: <b>{temp}</b></Alert>}
                  <Typography variant="caption" color="text.secondary">Registered {fdate(m.registrationDate)}</Typography>
                </Stack>
              )}
              {tab === 2 && (
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small"><TableHead><TableRow><TableCell>Receipt</TableCell><TableCell>Date</TableCell><TableCell>Description</TableCell><TableCell>Method</TableCell><TableCell align="right">Amount</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                    <TableBody>{d.data.payments.map((p) => <TableRow key={p._id}><TableCell>{p.receiptNo}</TableCell><TableCell>{fdate(p.paymentDate || p.createdAt)}</TableCell><TableCell>{p.description}</TableCell><TableCell>{p.paymentMethod}{p.referenceNumber ? ` · ${p.referenceNumber}` : ''}</TableCell><TableCell align="right">{peso(p.amount)}</TableCell><TableCell><StatusChip label={p.status} /></TableCell></TableRow>)}</TableBody></Table>
                  {!d.data.payments.length && <Empty>No payments.</Empty>}
                </Box>
              )}
              {tab === 3 && (
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small"><TableHead><TableRow><TableCell>Time in</TableCell><TableCell>Time out</TableCell><TableCell>Method</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                    <TableBody>{d.data.visits.map((v) => <TableRow key={v._id}><TableCell>{fdt(v.timeIn)}</TableCell><TableCell>{v.timeOut ? fdt(v.timeOut) : '—'}</TableCell><TableCell><StatusChip label={v.method} /></TableCell><TableCell><StatusChip label={v.status} /></TableCell></TableRow>)}</TableBody></Table>
                  {!d.data.visits.length && <Empty>No visits yet.</Empty>}
                </Box>
              )}
              {tab === 4 && (d.data.enrollments.length ? (
                <Stack spacing={1}>
                  {d.data.enrollments.map((e) => <Stack key={e._id} direction="row" justifyContent="space-between" sx={{ p: 1.2, bgcolor: brand.fill, borderRadius: 2 }}><Typography variant="body2" fontWeight={700}>{e.program?.programName}</Typography><Typography variant="caption" color="text.secondary">{e.program?.category} · since {fdate(e.enrollmentDate)}</Typography></Stack>)}
                </Stack>
              ) : <Empty>Not enrolled in any program.</Empty>)}
            </Stack>
          )}
        </DataState>
      </Box>
      <ConfirmDialog
        open={!!dup}
        title="Membership already recorded today"
        message={dup}
        confirmLabel="Record another"
        busy={busy}
        onClose={() => setDup('')}
        onConfirm={() => { setDup(''); sell(true); }}
      />
    </Drawer>
  );
}

export default function Members() {
  usePageTitle('Members', 'Manage all gym members, view their details, membership status and activity.');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [query, setQuery] = useState(params.get('q') || '');
  const status = params.get('status') || 'All';
  const list = useFetch('/members', { params: { q: query || undefined, status: status === 'All' ? undefined : status, limit: 100 } });
  const stats = useFetch('/members/stats');
  const plans = useFetch('/plans', { initial: [] });
  const coaches = useFetch('/coaches', { initial: [] });
  const [add, setAdd] = useState(false);
  const [open, setOpen] = useState(params.get('id') || null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const reload = () => {
    list.reload();
    stats.reload();
  };
  useSocketEvent('attendance:update', list.reload);
  const s = stats.data;
  const setStatus = (v) => setParams(v === 'All' ? {} : { status: v });

  return (
    <Stack spacing={2}>
      <Grid cols={{ xs: 1, sm: 3, lg: 5 }}>
        <StatCard label="Total members" value={s?.total ?? '—'} sub={s ? `+${s.newThisMonth} in 30 days` : ''} subColor={brand.green} />
        <StatCard label="Active" value={s?.active ?? '—'} sub="valid plan" />
        <StatCard label="Near expiry" value={s?.nearExpiry ?? '—'} sub="ending soon" />
        <StatCard label="Expired" value={s?.expired ?? '—'} subColor={brand.orange} sub={s ? `${s.pending} not yet paid` : ''} />
        <StatCard label="Student IDs to verify" value={s?.studentPending ?? '—'} sub="awaiting review" />
      </Grid>
      <Section>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 1.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField placeholder="Search name, ID, email or phone…" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: { xs: '100%', sm: 300 } }} inputProps={{ 'aria-label': 'Search members' }} />
            <TextField select value={status} onChange={(e) => setStatus(e.target.value)} sx={{ width: { xs: '100%', sm: 190 } }} inputProps={{ 'aria-label': 'Status filter' }}>
              {STATUSES.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
            </TextField>
          </Stack>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdd(true)}>Add member</Button>
        </Stack>
        <DataState {...list} onRetry={list.reload}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>Member</TableCell><TableCell>Plan</TableCell><TableCell>Valid until</TableCell><TableCell>Status</TableCell><TableCell>Student</TableCell><TableCell>Last visit</TableCell><TableCell>Phone</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {list.data?.items.map((m) => (
                  <TableRow key={m._id} hover sx={{ cursor: 'pointer' }} onClick={() => setOpen(m._id)}>
                    <TableCell><Stack direction="row" spacing={1} alignItems="center"><UserAvatar name={m.name} src={m.avatarUrl} /><Box><Typography variant="body2" fontWeight={700}>{m.name}</Typography><Typography variant="caption" color="text.secondary">{m.memberCode}{m.accountStatus === 'inactive' ? ' · inactive' : ''}</Typography></Box></Stack></TableCell>
                    <TableCell>{m.current?.planName || '—'}</TableCell>
                    <TableCell>{m.current?.endDate ? fdate(m.current.endDate) : '—'}</TableCell>
                    <TableCell><StatusChip label={m.status} /></TableCell>
                    <TableCell>{m.student?.status && m.student.status !== 'none' ? <StatusChip label={m.student.status} color={STUDENT_COLOR[m.student.status]} /> : '—'}</TableCell>
                    <TableCell>{m.lastVisitAt ? fdm(m.lastVisitAt) : '—'}</TableCell>
                    <TableCell>{m.phoneNumber}</TableCell>
                    <TableCell><Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); setOpen(m._id); }}>View</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!list.data?.items.length && <Empty>No members match.</Empty>}
          </Box>
          <Typography variant="caption" color="text.secondary">{list.data?.items.length} of {list.data?.total} shown</Typography>
        </DataState>
      </Section>
      <AddMemberDialog open={add} onClose={() => setAdd(false)} plans={plans.data || []} onSaved={reload} />
      <MemberDrawer id={open} onClose={() => setOpen(null)} plans={plans.data || []} coaches={coaches.data || []} onChanged={reload} />
    </Stack>
  );
}
