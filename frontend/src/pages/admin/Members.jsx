import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, FormControlLabel, IconButton, MenuItem, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
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
import { NameField, PhoneField } from '../../components/ContactFields';
import DeleteAccountDialog from '../../components/DeleteAccountDialog';
import useDraft, { keepOpenOnTapOutside } from '../../hooks/useDraft';

const GOALS = ['Weight Loss', 'Muscle Gain', 'Strength', 'General Fitness', 'Endurance', 'Flexibility'];
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const STATUSES = ['All', 'Active', 'Near Expiry', 'Expired', 'Pending', 'Student pending'];
const METHODS = ['Cash', 'GCash', 'Card', 'Other', 'Unpaid'];
const methodLabel = (m) => (m === 'Unpaid' ? 'Collect later (unpaid)' : m);
const STUDENT_COLOR = { verified: 'green', pending: 'amber', rejected: 'red' };

const plusDays = (iso, n) => (iso ? dayjs(iso).add(n, 'day').format('YYYY-MM-DD') : '');

function AddMemberDialog({ open, onClose, plans, onSaved }) {
  const toast = useToast();
  const active = plans.filter((p) => p.status === 'Active');
  const empty = { kind: 'new', firstName: '', lastName: '', email: '', phoneNumber: '', gender: 'Prefer not to say', birthdate: '', fitnessGoal: 'General Fitness', heightCm: '', address: '', emergencyContact: '', password: '', planId: '', method: 'Cash', referenceNumber: '', isStudent: false, school: '', memberSince: '', startDate: '', endDate: '', amountPaid: '', paymentDate: '', recordPayment: true };
  const [f, setF, clearDraft] = useDraft('gymora:draft:add-member', empty);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const existing = f.kind === 'existing';
  const plan = active.find((p) => String(p._id) === String(f.planId));
  useEffect(() => {
    if (open) {
      setResult(null);
      if (!f.planId && !f.firstName && !f.email) setF((x) => ({ ...x, planId: active.find((p) => !p.isStudentPlan)?._id || '' }));
    }
  }, [open]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const pickPlan = (e) => {
    const next = active.find((p) => String(p._id) === String(e.target.value));
    setF({ ...f, planId: e.target.value, amountPaid: next ? String(next.price) : f.amountPaid, endDate: next && f.startDate ? plusDays(f.startDate, next.duration - 1) : f.endDate });
  };
  const pickStart = (e) => {
    const v = e.target.value;
    setF({ ...f, startDate: v, endDate: plan && v ? plusDays(v, plan.duration - 1) : f.endDate, paymentDate: f.paymentDate || v });
  };
  const lock = useRef(false);
  const close = () => {
    if (result) clearDraft();
    onClose();
  };
  const submit = async (e) => {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const base = { firstName: f.firstName, lastName: f.lastName, email: f.email, phoneNumber: f.phoneNumber, gender: f.gender, fitnessGoal: f.fitnessGoal, address: f.address, emergencyContact: f.emergencyContact, isStudent: f.isStudent, school: f.school, password: f.password || undefined, heightCm: f.heightCm || undefined, birthdate: f.birthdate || undefined, planId: f.planId || undefined, referenceNumber: f.referenceNumber || undefined };
      const body = existing
        ? { ...base, existing: true, memberSince: f.memberSince || undefined, startDate: f.planId ? f.startDate : undefined, endDate: f.planId ? f.endDate || undefined : undefined, amountPaid: f.planId && f.recordPayment ? f.amountPaid : undefined, paymentDate: f.planId && f.recordPayment ? f.paymentDate || f.startDate : undefined, recordPayment: !!f.recordPayment, method: f.planId && f.recordPayment ? (f.method === 'Unpaid' ? 'Cash' : f.method) : undefined }
        : { ...base, method: f.planId ? f.method : undefined };
      const { data } = await api.post('/members', body);
      setResult(data);
      clearDraft({ ...empty, kind: f.kind });
      onSaved();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const today = dayjs().format('YYYY-MM-DD');
  return (
    <Dialog open={open} onClose={keepOpenOnTapOutside(close)} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: submit }}>
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
            <ToggleButtonGroup exclusive fullWidth value={f.kind} onChange={(_, v) => v && setF({ ...f, kind: v })} aria-label="Member type">
              <ToggleButton value="new" sx={{ textTransform: 'none', fontWeight: 700 }}>New member</ToggleButton>
              <ToggleButton value="existing" sx={{ textTransform: 'none', fontWeight: 700 }}>Existing member</ToggleButton>
            </ToggleButtonGroup>
            {existing && <Alert severity="info">Use this for people who were already members before the gym started using GYMORA. Enter their original join date and their current membership so their remaining days carry over.</Alert>}
            <Grid cols={{ xs: 1, sm: 2 }}>
              <NameField label="First name" value={f.firstName} onChange={set('firstName')} required />
              <NameField label="Last name" value={f.lastName} onChange={set('lastName')} required />
              <TextField label="Email" type="email" value={f.email} onChange={set('email')} required />
              <PhoneField label="Phone number" value={f.phoneNumber} onChange={set('phoneNumber')} required />
              {existing && <TextField label="Member since" type="date" value={f.memberSince} onChange={set('memberSince')} InputLabelProps={{ shrink: true }} inputProps={{ max: today }} helperText="The date they first joined the gym" required />}
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
            {existing ? (
              <>
                <Typography variant="subtitle2">Current membership</Typography>
                <Grid cols={{ xs: 1, sm: 2 }}>
                  <TextField select label="Membership plan" value={f.planId} onChange={pickPlan}>
                    <MenuItem value="">No active membership</MenuItem>
                    {active.map((p) => <MenuItem key={p._id} value={p._id}>{p.planName} · {p.duration} days · {peso0(p.price)}</MenuItem>)}
                  </TextField>
                  {f.planId && <TextField label="Started on" type="date" value={f.startDate} onChange={pickStart} InputLabelProps={{ shrink: true }} required />}
                  {f.planId && <TextField label="Ends on" type="date" value={f.endDate} onChange={set('endDate')} InputLabelProps={{ shrink: true }} inputProps={{ min: f.startDate || undefined }} helperText="Filled from the plan length; change it if needed" />}
                </Grid>
                {f.planId && (
                  <>
                    <FormControlLabel control={<Checkbox checked={!!f.recordPayment} onChange={(e) => setF({ ...f, recordPayment: e.target.checked })} />} label="Record the payment they made (shows in sales reports on the payment date)" />
                    {f.recordPayment && (
                      <Grid cols={{ xs: 1, sm: 3 }}>
                        <TextField label="Amount paid (₱)" type="number" value={f.amountPaid} onChange={set('amountPaid')} inputProps={{ min: 0, step: '0.01' }} />
                        <TextField label="Paid on" type="date" value={f.paymentDate} onChange={set('paymentDate')} InputLabelProps={{ shrink: true }} inputProps={{ max: today }} />
                        <TextField select label="Paid with" value={f.method === 'Unpaid' ? 'Cash' : f.method} onChange={set('method')}>{['Cash', 'GCash', 'Card', 'Other'].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}</TextField>
                      </Grid>
                    )}
                  </>
                )}
              </>
            ) : (
              <Grid cols={{ xs: 1, sm: 2 }}>
                <TextField select label="Membership plan" value={f.planId} onChange={set('planId')}>
                  <MenuItem value="">No plan yet</MenuItem>
                  {active.map((p) => <MenuItem key={p._id} value={p._id} disabled={p.isStudentPlan && !f.isStudent}>{p.planName} · {p.duration} days · {peso0(p.price)}</MenuItem>)}
                </TextField>
                {f.planId && <TextField select label="Payment" value={f.method} onChange={set('method')}>{METHODS.map((m) => <MenuItem key={m} value={m}>{methodLabel(m)}</MenuItem>)}</TextField>}
                {f.planId && ['GCash', 'Card', 'Other'].includes(f.method) && <TextField label="Reference number" value={f.referenceNumber} onChange={set('referenceNumber')} />}
              </Grid>
            )}
            <Typography variant="caption" color="text.secondary">The member logs in at the Member login with this email. Their login details are emailed to them. What you type here is kept if the window closes by accident.</Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {!result && <Button color="inherit" onClick={() => clearDraft({ ...empty, kind: f.kind })} sx={{ mr: 'auto' }}>Clear form</Button>}
        <Button variant="outlined" onClick={close}>{result ? 'Done' : 'Close'}</Button>
        {!result && <Button type="submit" variant="contained" disabled={busy}>{existing ? 'Add existing member' : 'Register member'}</Button>}
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
      setEdit({ registrationDate: m.registrationDate ? dayjs(m.registrationDate).format('YYYY-MM-DD') : '', firstName: m.firstName || '', lastName: m.lastName || '', email: m.email || '', phoneNumber: m.phoneNumber || '', gender: m.gender || 'Prefer not to say', birthdate: m.birthdate ? dayjs(m.birthdate).format('YYYY-MM-DD') : '', fitnessGoal: m.fitnessGoal || 'General Fitness', heightCm: m.heightCm || '', address: m.address || '', emergencyContact: m.emergencyContact || '', assignedCoach: m.assignedCoach || '' });
    }
  }, [d.data, plans]);

  const [dup, setDup] = useState('');
  const [del, setDel] = useState(false);
  const [msEdit, setMsEdit] = useState(null);
  const [payEdit, setPayEdit] = useState(null);
  const [prev, setPrev] = useState(null);
  const isAdmin = role === 'admin';
  const openPrev = () => {
    const p = active.find((x) => !x.isStudentPlan) || active[0];
    const start = dayjs().format('YYYY-MM-DD');
    setPrev({ planId: p?._id || '', startDate: start, endDate: p ? plusDays(start, p.duration - 1) : '', amountPaid: p ? String(p.price) : '', paymentDate: start, method: 'Cash', recordPayment: true });
  };
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
                  {isAdmin && (
                    <Alert severity="info" action={<Button size="small" variant="outlined" onClick={openPrev} disabled={busy}>Add from records</Button>}>
                      Was this person already a member before GYMORA? Add their current or past membership from your old records. It does not charge them again.
                    </Alert>
                  )}
                  <Box sx={{ overflowX: 'auto' }}>
                    <Table size="small"><TableHead><TableRow><TableCell>Plan</TableCell><TableCell>Start</TableCell><TableCell>End</TableCell><TableCell align="right">Price</TableCell><TableCell>Status</TableCell>{isAdmin && <TableCell />}</TableRow></TableHead>
                      <TableBody>{d.data.memberships.map((x) => (
                        <TableRow key={x._id}>
                          <TableCell>{x.planName}{x.fromPreviousRecords && <Typography variant="caption" display="block" color="text.secondary">from previous records</Typography>}</TableCell>
                          <TableCell>{fdate(x.startDate)}</TableCell><TableCell>{fdate(x.endDate)}</TableCell><TableCell align="right">{peso(x.price)}</TableCell><TableCell><StatusChip label={x.status} /></TableCell>
                          {isAdmin && <TableCell>{x.status === 'Active' && <Button size="small" onClick={() => setMsEdit({ _id: x._id, planName: x.planName, startDate: x.startDate ? dayjs(x.startDate).format('YYYY-MM-DD') : '', endDate: x.endDate ? dayjs(x.endDate).format('YYYY-MM-DD') : '', price: String(x.price ?? '') })}>Edit</Button>}</TableCell>}
                        </TableRow>
                      ))}</TableBody></Table>
                    {!d.data.memberships.length && <Empty>No memberships yet.</Empty>}
                  </Box>
                </Stack>
              )}
              {tab === 1 && edit && (
                <Stack component="form" spacing={2} onSubmit={(e) => { e.preventDefault(); const { registrationDate, ...rest } = edit; run(() => api.patch(`/members/${id}`, { ...rest, ...(isAdmin && registrationDate ? { registrationDate } : {}), heightCm: edit.heightCm || undefined, birthdate: edit.birthdate || undefined, assignedCoach: edit.assignedCoach || null }), 'Member updated'); }}>
                  <Grid cols={{ xs: 1, sm: 2 }}>
                    {isAdmin && <TextField label="Member since" type="date" value={edit.registrationDate} onChange={sE('registrationDate')} InputLabelProps={{ shrink: true }} inputProps={{ max: dayjs().format('YYYY-MM-DD') }} helperText="Change this for members who joined before GYMORA" />}
                    <NameField label="First name" value={edit.firstName} onChange={sE('firstName')} required />
                    <NameField label="Last name" value={edit.lastName} onChange={sE('lastName')} required />
                    <TextField label="Email" type="email" value={edit.email} onChange={sE('email')} required />
                    <PhoneField label="Phone number" value={edit.phoneNumber} onChange={sE('phoneNumber')} />
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
                    {role === 'admin' && m.accountStatus === 'inactive' && <Button variant="contained" color="error" disabled={busy} onClick={() => setDel(true)}>Delete permanently</Button>}
                  </Stack>
                  {temp && <Alert severity="success">Temporary password: <b>{temp}</b></Alert>}
                  <Typography variant="caption" color="text.secondary">Registered {fdate(m.registrationDate)}</Typography>
                </Stack>
              )}
              {tab === 2 && (
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small"><TableHead><TableRow><TableCell>Receipt</TableCell><TableCell>Date</TableCell><TableCell>Description</TableCell><TableCell>Method</TableCell><TableCell align="right">Amount</TableCell><TableCell>Status</TableCell>{isAdmin && <TableCell />}</TableRow></TableHead>
                    <TableBody>{d.data.payments.map((p) => (
                      <TableRow key={p._id}>
                        <TableCell>{p.receiptNo}</TableCell><TableCell>{fdate(p.paymentDate || p.createdAt)}</TableCell><TableCell>{p.description}</TableCell><TableCell>{p.paymentMethod}{p.referenceNumber ? ` · ${p.referenceNumber}` : ''}</TableCell><TableCell align="right">{peso(p.amount)}</TableCell><TableCell><StatusChip label={p.status} /></TableCell>
                        {isAdmin && <TableCell>{p.status === 'Paid' && !p.posTransaction && <Button size="small" onClick={() => setPayEdit({ _id: p._id, receiptNo: p.receiptNo, online: !!p.online?.checkoutId, amount: String(p.amount), paymentDate: dayjs(p.paymentDate || p.createdAt).format('YYYY-MM-DD'), paymentMethod: ['Cash', 'GCash', 'Card', 'Other'].includes(p.paymentMethod) ? p.paymentMethod : 'Cash', referenceNumber: p.referenceNumber || '' })}>Edit</Button>}</TableCell>}
                      </TableRow>
                    ))}</TableBody></Table>
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
      {d.data?.member && (
        <DeleteAccountDialog
          open={del}
          kind="member"
          title={`Delete ${d.data.member.name}?`}
          expect={d.data.member.memberCode}
          onClose={() => setDel(false)}
          onConfirm={async (confirm) => {
            try {
              const { data } = await api.delete(`/members/${id}`, { data: { confirm } });
              toast(data.message);
              setDel(false);
              onChanged();
              onClose();
            } catch (err) {
              toast(errMsg(err), 'error');
            }
          }}
        />
      )}
      <Dialog open={!!msEdit} onClose={keepOpenOnTapOutside(() => setMsEdit(null))} maxWidth="xs" fullWidth PaperProps={{ component: 'form', onSubmit: async (e) => { e.preventDefault(); const r = await run(() => api.patch(`/members/${id}/memberships/${msEdit._id}`, { startDate: msEdit.startDate, endDate: msEdit.endDate, price: msEdit.price }), 'Membership updated'); if (r) setMsEdit(null); } }}>
        <DialogTitle>Edit {msEdit?.planName}</DialogTitle>
        <DialogContent>
          {msEdit && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Start date" type="date" value={msEdit.startDate} onChange={(e) => setMsEdit({ ...msEdit, startDate: e.target.value })} InputLabelProps={{ shrink: true }} required />
              <TextField label="End date" type="date" value={msEdit.endDate} onChange={(e) => setMsEdit({ ...msEdit, endDate: e.target.value })} InputLabelProps={{ shrink: true }} inputProps={{ min: msEdit.startDate || undefined }} required />
              <TextField label="Price (₱)" type="number" value={msEdit.price} onChange={(e) => setMsEdit({ ...msEdit, price: e.target.value })} inputProps={{ min: 0, step: '0.01' }} helperText="This changes the membership record only. Edit the payment in the Payments tab." />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={() => setMsEdit(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy}>Save</Button></DialogActions>
      </Dialog>
      <Dialog open={!!payEdit} onClose={keepOpenOnTapOutside(() => setPayEdit(null))} maxWidth="xs" fullWidth PaperProps={{ component: 'form', onSubmit: async (e) => { e.preventDefault(); const r = await run(() => api.patch(`/payments/${payEdit._id}`, { amount: payEdit.online ? undefined : payEdit.amount, paymentDate: payEdit.paymentDate, paymentMethod: payEdit.online ? undefined : payEdit.paymentMethod, referenceNumber: payEdit.referenceNumber }), 'Payment updated'); if (r) setPayEdit(null); } }}>
        <DialogTitle>Edit payment {payEdit?.receiptNo}</DialogTitle>
        <DialogContent>
          {payEdit && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {payEdit.online && <Alert severity="info">This was paid online through PayMongo, so only the date and reference can be changed.</Alert>}
              <TextField label="Amount (₱)" type="number" value={payEdit.amount} onChange={(e) => setPayEdit({ ...payEdit, amount: e.target.value })} inputProps={{ min: 0, step: '0.01' }} disabled={payEdit.online} required />
              <TextField label="Paid on" type="date" value={payEdit.paymentDate} onChange={(e) => setPayEdit({ ...payEdit, paymentDate: e.target.value })} InputLabelProps={{ shrink: true }} inputProps={{ max: dayjs().format('YYYY-MM-DD') }} required />
              <TextField select label="Paid with" value={payEdit.paymentMethod} onChange={(e) => setPayEdit({ ...payEdit, paymentMethod: e.target.value })} disabled={payEdit.online}>{['Cash', 'GCash', 'Card', 'Other'].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField>
              <TextField label="Reference number" value={payEdit.referenceNumber} onChange={(e) => setPayEdit({ ...payEdit, referenceNumber: e.target.value })} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={() => setPayEdit(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy}>Save</Button></DialogActions>
      </Dialog>
      <Dialog open={!!prev} onClose={keepOpenOnTapOutside(() => setPrev(null))} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: async (e) => { e.preventDefault(); const r = await run(() => api.post(`/members/${id}/memberships/existing`, { ...prev, amountPaid: prev.recordPayment ? prev.amountPaid : undefined, paymentDate: prev.recordPayment ? prev.paymentDate : undefined }), 'Membership added from records'); if (r) setPrev(null); } }}>
        <DialogTitle>Add membership from previous records</DialogTitle>
        <DialogContent>
          {prev && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Grid cols={{ xs: 1, sm: 3 }}>
                <TextField select label="Plan" value={prev.planId} onChange={(e) => { const p = active.find((x) => String(x._id) === String(e.target.value)); setPrev({ ...prev, planId: e.target.value, amountPaid: p ? String(p.price) : prev.amountPaid, endDate: p && prev.startDate ? plusDays(prev.startDate, p.duration - 1) : prev.endDate }); }} required>
                  {active.map((p) => <MenuItem key={p._id} value={p._id}>{p.planName} · {p.duration}d · {peso0(p.price)}</MenuItem>)}
                </TextField>
                <TextField label="Started on" type="date" value={prev.startDate} onChange={(e) => { const p = active.find((x) => String(x._id) === String(prev.planId)); setPrev({ ...prev, startDate: e.target.value, endDate: p && e.target.value ? plusDays(e.target.value, p.duration - 1) : prev.endDate }); }} InputLabelProps={{ shrink: true }} required />
                <TextField label="Ends on" type="date" value={prev.endDate} onChange={(e) => setPrev({ ...prev, endDate: e.target.value })} InputLabelProps={{ shrink: true }} inputProps={{ min: prev.startDate || undefined }} required />
              </Grid>
              <FormControlLabel control={<Checkbox checked={prev.recordPayment} onChange={(e) => setPrev({ ...prev, recordPayment: e.target.checked })} />} label="Record the payment they made (shows in sales reports on the payment date)" />
              {prev.recordPayment && (
                <Grid cols={{ xs: 1, sm: 3 }}>
                  <TextField label="Amount paid (₱)" type="number" value={prev.amountPaid} onChange={(e) => setPrev({ ...prev, amountPaid: e.target.value })} inputProps={{ min: 0, step: '0.01' }} />
                  <TextField label="Paid on" type="date" value={prev.paymentDate} onChange={(e) => setPrev({ ...prev, paymentDate: e.target.value })} InputLabelProps={{ shrink: true }} inputProps={{ max: dayjs().format('YYYY-MM-DD') }} />
                  <TextField select label="Paid with" value={prev.method} onChange={(e) => setPrev({ ...prev, method: e.target.value })}>{['Cash', 'GCash', 'Card', 'Other'].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField>
                </Grid>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={() => setPrev(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy}>Add membership</Button></DialogActions>
      </Dialog>
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
