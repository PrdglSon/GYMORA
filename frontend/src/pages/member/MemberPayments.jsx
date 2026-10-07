import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardActionArea, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Grid, Section, StatusChip, Empty } from '../../components/ui';
import { fdate, peso, peso0 } from '../../utils/format';
import { brand, DISPLAY_FONT } from '../../theme';

const COLORS = { Active: brand.green, 'Near Expiry': brand.yellow, 'Grace Period': brand.orange, Expired: brand.red, Pending: brand.ink2 };

export default function MemberPayments() {
  usePageTitle('Payments', 'Manage your membership and payments.');
  const toast = useToast();
  const { refresh, gym } = useAuth();
  const online = !!gym?.paymongo?.enabled;
  const methodsLabel = (gym?.paymongo?.methods || []).map((x) => ({ card: 'Card', gcash: 'GCash', paymaya: 'Maya', grab_pay: 'GrabPay', qrph: 'QR Ph' })[x]).filter(Boolean).join(', ');
  const [params, setParams] = useSearchParams();
  const [checking, setChecking] = useState(false);
  const me = useFetch('/members/me');
  const plans = useFetch('/plans', { initial: [] });
  const [planId, setPlanId] = useState('');
  const [method, setMethod] = useState(online ? 'Online' : 'GCash');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);

  const m = me.data?.member;
  const payments = me.data?.payments || [];
  const memberships = me.data?.memberships || [];
  const unpaid = payments.find((p) => p.status === 'Unpaid' && p.paymentType === 'Membership');
  const studentOk = m?.student?.status === 'verified';
  const usable = (plans.data || []).filter((p) => !p.isStudentPlan || studentOk);
  const fallback = usable.find((p) => String(p._id) === String(m?.current?.plan)) || usable[0];
  const chosen = planId || fallback?._id || '';
  const plan = (plans.data || []).find((p) => p._id === chosen);

  useEffect(() => {
    const id = params.get('online');
    const cancelled = params.get('cancelled');
    if (params.get('onlineFailed')) {
      toast('Your account is ready, but the online payment could not start. Use "Pay online" on your invoice below or pay at the front desk.', 'info');
      setParams({}, { replace: true });
      return;
    }
    if (cancelled) {
      toast('Online payment cancelled. You can try again or choose another way to pay.', 'info');
      setParams({}, { replace: true });
      return;
    }
    if (!id) return;
    let alive = true;
    setChecking(true);
    (async () => {
      for (let i = 0; i < 6 && alive; i++) {
        try {
          const { data } = await api.post(`/online-payments/${id}/verify`);
          if (data.status === 'Paid') {
            toast(`Payment received (${data.receiptNo}). Thank you!`);
            break;
          }
        } catch (err) {
          toast(errMsg(err), 'error');
          break;
        }
        if (i === 5) toast('We are still waiting for PayMongo to confirm. Your plan activates automatically once it does.', 'info');
        await new Promise((res) => setTimeout(res, 3000));
      }
      if (!alive) return;
      setChecking(false);
      setParams({}, { replace: true });
      me.reload();
      refresh();
    })();
    return () => { alive = false; };
  }, []);

  const payOnline = async (body) => {
    setBusy(true);
    try {
      const { data } = await api.post('/online-payments/checkout', body);
      if (data.paid) {
        toast('This invoice is already paid.');
        me.reload();
        refresh();
        setBusy(false);
        return;
      }
      window.location.assign(data.checkoutUrl);
    } catch (err) {
      toast(errMsg(err), 'error');
      setBusy(false);
    }
  };

  const renew = async (e) => {
    e.preventDefault();
    if (!plan) return;
    if (method === 'Online') return payOnline({ planId: plan._id });
    setBusy(true);
    try {
      const body = { planId: plan._id, method };
      if (method === 'GCash') body.referenceNumber = ref;
      const { data } = await api.post('/members/me/renew', body);
      toast(data.message);
      setRef('');
      me.reload();
      refresh();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DataState {...me} onRetry={me.reload}>
      {m && (
        <Stack spacing={2}>
          <Grid cols={{ xs: 1, md: '1fr 2fr' }}>
            <Section>
              <Typography variant="overline">Your membership is</Typography>
              <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: 36, textTransform: 'uppercase', color: COLORS[m.status] || brand.ink }}>{m.status}</Typography>
              <Typography fontWeight={700}>{m.current?.planName || 'No paid plan yet'}</Typography>
              {m.current?.endDate && <Typography variant="body2" color="text.secondary">{fdate(m.current.startDate)} – {fdate(m.current.endDate)}</Typography>}
              <Typography sx={{ fontSize: 28, fontWeight: 800, mt: 1 }}>{m.daysLeft != null ? Math.max(0, m.daysLeft) : '—'}</Typography>
              <Typography variant="body2" color="text.secondary">Days remaining</Typography>
              {m.status === 'Grace Period' && <Alert severity="warning" sx={{ mt: 1.5 }}>Your plan has ended. You can still check in during the grace period. Renew to keep access.</Alert>}
              {m.student?.status && m.student.status !== 'none' && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
                  <Typography variant="body2">Student ID:</Typography>
                  <StatusChip label={m.student.status} />
                </Stack>
              )}
            </Section>
            <Section title="Renew or change plan">
              {checking && <Alert severity="info" sx={{ mb: 2 }}>Confirming your online payment with PayMongo…</Alert>}
              {unpaid ? (
                <Alert severity="info" action={online && !unpaid.referenceNumber ? <Button color="inherit" size="small" disabled={busy || checking} onClick={() => payOnline({ paymentId: unpaid._id })}>Pay online</Button> : undefined}>
                  Invoice <b>{unpaid.receiptNo}</b> for {peso(unpaid.amount)} is waiting. {unpaid.referenceNumber ? `Staff are verifying your GCash reference ${unpaid.referenceNumber}.` : online ? `Pay online now (${methodsLabel}) or at the front desk to activate it.` : 'Pay at the front desk to activate it.'}
                </Alert>
              ) : (
                <Stack component="form" spacing={2} onSubmit={renew}>
                  <DataState {...plans} onRetry={plans.reload}>
                    <Grid cols={{ xs: 1, sm: 2 }} gap={1}>
                      {(plans.data || []).map((p) => {
                        const blocked = p.isStudentPlan && !studentOk;
                        const sel = chosen === p._id;
                        return (
                          <Card key={p._id} sx={{ opacity: blocked ? 0.5 : 1, borderColor: sel ? brand.yellow : undefined, bgcolor: sel ? brand.yellowSoft : '#fff' }}>
                            <CardActionArea disabled={blocked} onClick={() => setPlanId(p._id)} sx={{ p: 1.5, height: '100%' }}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                <Typography variant="body2" fontWeight={700}>{p.planName}</Typography>
                                {p.highlight && <Chip size="small" label="Popular" sx={{ bgcolor: brand.yellow, color: '#fff' }} />}
                              </Stack>
                              <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{peso0(p.price)}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {p.duration} days{p.isStudentPlan ? ' · Student plan' : ''}{blocked ? ' · verify your student ID first' : ''}
                              </Typography>
                              {p.description && <Typography variant="caption" color="text.secondary" display="block">{p.description}</Typography>}
                            </CardActionArea>
                          </Card>
                        );
                      })}
                    </Grid>
                    {!plans.data?.length && <Empty>No plans available.</Empty>}
                  </DataState>
                  <ToggleButtonGroup exclusive value={method} onChange={(_, v) => v && setMethod(v)} size="small" color="secondary">
                    {online && <ToggleButton value="Online">Pay online</ToggleButton>}
                    <ToggleButton value="GCash">GCash reference</ToggleButton>
                    <ToggleButton value="Cash">Pay at front desk</ToggleButton>
                  </ToggleButtonGroup>
                  {method === 'Online' ? (
                    <Typography variant="body2" color="text.secondary">You'll go to PayMongo's secure page to pay {plan ? peso(plan.price) : ''} by {methodsLabel || 'card or e-wallet'}. Your plan activates automatically once the payment is confirmed.</Typography>
                  ) : method === 'GCash' ? (
                    <TextField
                      label="GCash reference number"
                      value={ref}
                      onChange={(e) => setRef(e.target.value.replace(/\D/g, '').slice(0, 13))}
                      required
                      inputProps={{ pattern: '\\d{10,13}', inputMode: 'numeric' }}
                      helperText={`Send ${plan ? peso(plan.price) : 'the plan amount'} to the gym's GCash, then enter the 10 to 13 digit reference. Staff verify it before your plan activates.`}
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary">We'll reserve your renewal. Your plan extends once the front desk records your payment.</Typography>
                  )}
                  <Button type="submit" variant="contained" disabled={busy || !plan} sx={{ alignSelf: 'flex-start' }}>
                    {method === 'Online' ? `Pay ${plan ? peso(plan.price) : ''} online` : method === 'GCash' ? `Submit ${plan ? peso(plan.price) : ''} payment` : 'Reserve renewal'}
                  </Button>
                </Stack>
              )}
            </Section>
          </Grid>

          <Section title="Transaction history">
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Receipt</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p._id}>
                      <TableCell>{p.receiptNo}</TableCell>
                      <TableCell>{fdate(p.paymentDate || p.createdAt)}</TableCell>
                      <TableCell>{p.description || p.paymentType}</TableCell>
                      <TableCell>{p.paymentMethod}</TableCell>
                      <TableCell>{p.referenceNumber || '—'}</TableCell>
                      <TableCell align="right">{peso(p.amount)}</TableCell>
                      <TableCell><StatusChip label={p.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!payments.length && <Empty>No payments yet.</Empty>}
            </Box>
          </Section>

          <Section title="Membership history">
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Plan</TableCell>
                    <TableCell>Start</TableCell>
                    <TableCell>End</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {memberships.map((x) => (
                    <TableRow key={x._id}>
                      <TableCell>{x.planName}</TableCell>
                      <TableCell>{fdate(x.startDate)}</TableCell>
                      <TableCell>{fdate(x.endDate)}</TableCell>
                      <TableCell align="right">{peso(x.price)}</TableCell>
                      <TableCell><StatusChip label={x.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!memberships.length && <Empty>No memberships yet.</Empty>}
            </Box>
          </Section>
        </Stack>
      )}
    </DataState>
  );
}
