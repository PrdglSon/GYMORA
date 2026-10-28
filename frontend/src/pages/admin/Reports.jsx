import { Fragment, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { keepOpenOnTapOutside } from '../../hooks/useDraft';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Grid, Section, StatCard, StatusChip, Progress, Empty, ConfirmDialog } from '../../components/ui';
import { LineChart, BarChart, DonutChart } from '../../components/Charts';
import { peso, peso0, fdate, hourLabel, pct, isoDay } from '../../utils/format';
import { brand } from '../../theme';

const COLORS = [brand.yellow, brand.orange, brand.green, brand.blue, brand.purple, '#888'];
const METHOD_COLORS = { Cash: brand.green, GCash: brand.blue, Card: brand.purple, Other: '#888' };

const EXPENSE_CATEGORIES = ['Utilities (electricity, water, internet)', 'Rent', 'Salaries and wages', 'Supplies (water, cleaning, toiletries)', 'Equipment and repairs', 'Products for resale', 'Marketing', 'Other'];
const PAID_WITH = ['Cash', 'GCash', 'Bank transfer', 'Card', 'Other'];
const dayNum = (d) => dayjs(d).format('D');

function MoneyRow({ label, value, sign, strong, color }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ py: 1, borderBottom: strong ? 0 : `1px dashed ${brand.line}` }}>
      <Typography sx={{ fontWeight: strong ? 800 : 600, fontSize: strong ? 18 : 15 }}>{label}</Typography>
      <Typography sx={{ fontWeight: 800, fontSize: strong ? 26 : 18, color: color || 'text.primary', fontVariantNumeric: 'tabular-nums' }}>{sign}{peso(value)}</Typography>
    </Stack>
  );
}

function ProfitSummary({ x }) {
  const p = x.profit;
  const gain = p.net >= 0;
  const prevNet = p.previous.net;
  const change = p.net - prevNet;
  return (
    <Section title={`Money in and out · ${x.label}`}>
      <Grid cols={{ xs: 1, md: '1.2fr 1fr' }} gap={3}>
        <Box>
          <MoneyRow label="Total sales (money in)" value={p.sales} sign="" color={brand.green} />
          <MoneyRow label="Total expenses (money out)" value={p.expenses} sign="− " color={brand.red} />
          <Box sx={{ borderTop: `2px solid ${brand.ink}`, mt: 0.5 }} />
          <MoneyRow label={gain ? 'Net income (profit)' : 'Net loss'} value={Math.abs(p.net)} sign={gain ? '' : '− '} strong color={gain ? brand.green : brand.red} />
          <Alert severity={gain ? 'success' : 'warning'} sx={{ mt: 1 }}>
            {gain
              ? `The gym earned ${peso(p.sales)} and spent ${peso(p.expenses)} in ${x.label}, so it kept ${peso(p.net)}.`
              : `The gym spent ${peso(p.expenses)} but only earned ${peso(p.sales)} in ${x.label}, a loss of ${peso(Math.abs(p.net))}.`}
            {' '}
            {p.previous.sales || p.previous.expenses
              ? `That is ${peso(Math.abs(change))} ${change >= 0 ? 'more' : 'less'} than ${p.previous.label} (${prevNet >= 0 ? 'profit' : 'loss'} of ${peso(Math.abs(prevNet))}).`
              : ''}
          </Alert>
          {x.isCurrentMonth && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>This month is not over yet. Totals so far, up to today.</Typography>}
        </Box>
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Where the sales came from</Typography>
          <Table size="small">
            <TableBody>
              {[['Memberships', x.totals.byType.membership], ['Walk-in day passes', x.totals.byType.walkin], ['Products (POS)', x.totals.byType.retail], ['Other payments', x.totals.byType.other]].map(([k, v]) => (
                <TableRow key={k}><TableCell>{k}</TableCell><TableCell align="right">{peso(v)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Where the money went</Typography>
          {p.expensesByCategory.length ? (
            <Table size="small">
              <TableBody>{p.expensesByCategory.map((c) => <TableRow key={c.category}><TableCell>{c.category}</TableCell><TableCell align="right">{peso(c.amount)}</TableCell></TableRow>)}</TableBody>
            </Table>
          ) : <Typography variant="body2" color="text.secondary">No expenses recorded for this month yet.</Typography>}
        </Box>
      </Grid>
    </Section>
  );
}

function Expenses({ month, label, x, onChanged }) {
  const toast = useToast();
  const list = useFetch('/expenses', { params: { month } });
  const blank = () => ({ date: dayjs(`${month}-01`).isSame(dayjs(), 'month') ? isoDay() : dayjs(`${month}-01`).endOf('month').format('YYYY-MM-DD'), description: '', category: 'Supplies (water, cleaning, toiletries)', amount: '', paidWith: 'Cash' });
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const refresh = () => {
    list.reload();
    onChanged();
  };
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { date: edit.date, description: edit.description, category: edit.category, amount: edit.amount, paidWith: edit.paidWith };
      if (edit._id) await api.patch(`/expenses/${edit._id}`, body);
      else await api.post('/expenses', body);
      toast(edit._id ? 'Expense updated' : 'Expense added');
      setEdit(null);
      refresh();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/expenses/${del._id}`);
      toast('Expense deleted');
      setDel(null);
      refresh();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const items = list.data?.items || [];
  const byDay = {};
  items.forEach((e) => {
    const k = isoDay(e.date);
    (byDay[k] = byDay[k] || []).push(e);
  });
  const today = isoDay();
  const days = x.revenue.membership
    .map((d, i) => {
      const sales = Math.round((d.value + (x.revenue.walkin[i]?.value || 0) + (x.revenue.retail[i]?.value || 0)) * 100) / 100;
      const list2 = byDay[d.date] || [];
      const spent = Math.round(list2.reduce((a, e) => a + e.amount, 0) * 100) / 100;
      return { date: d.date, sales, spent, net: Math.round((sales - spent) * 100) / 100, items: list2 };
    })
    .filter((d) => d.date <= today)
    .reverse();
  const shown = showAll ? days : days.filter((d) => d.sales || d.spent || d.date === today);
  const totals = days.reduce((a, d) => ({ sales: a.sales + d.sales, spent: a.spent + d.spent }), { sales: 0, spent: 0 });
  const netColor = (n) => (n >= 0 ? brand.green : brand.red);
  const csvRows = () => days.slice().reverse().flatMap((d) => [
    [d.date, 'DAY TOTAL', '', '', d.sales, d.spent, d.net],
    ...d.items.map((e) => [d.date, e.description, e.category, e.paidWith, '', e.amount, '']),
  ]);
  return (
    <Section
      title={`Daily sales and expenses · ${label}`}
      action={(
        <Stack direction="row" spacing={1}>
          {days.length > 0 && <CsvButton onClick={() => downloadCsv(`daily-${month}`, ['Date', 'Item', 'Category', 'Paid with', 'Sales', 'Expenses', 'Net'], csvRows())} />}
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setEdit(blank())}>Add expense</Button>
        </Stack>
      )}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Each day shows what the gym earned, what it spent (water jug, bills, repairs…) and what was left. Add an expense on the day it was paid.</Typography>
      <DataState {...list} onRetry={list.reload}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
            <TableHead>
              <TableRow>
                <TableCell>Day</TableCell>
                <TableCell align="right">Sales</TableCell>
                <TableCell align="right">− Expenses</TableCell>
                <TableCell align="right">= Net</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {shown.map((d) => (
                <Fragment key={d.date}>
                  <TableRow sx={{ bgcolor: d.date === today ? brand.yellowSoft : brand.fill, '& td': { borderBottom: d.items.length ? 0 : undefined } }}>
                    <TableCell><b>{dayjs(d.date).format('ddd, MMM D')}</b>{d.date === today && <Typography component="span" variant="caption" sx={{ ml: 1, fontWeight: 800, color: brand.yellowInk }}>TODAY</Typography>}</TableCell>
                    <TableCell align="right">{peso(d.sales)}</TableCell>
                    <TableCell align="right">{d.spent ? peso(d.spent) : '—'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: netColor(d.net) }}>{d.net < 0 ? '− ' : ''}{peso(Math.abs(d.net))}</TableCell>
                    <TableCell align="right"><Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={() => setEdit({ ...blank(), date: d.date })}>Expense</Button></TableCell>
                  </TableRow>
                  {d.items.map((e, i) => (
                    <TableRow key={e._id} sx={{ '& td': { borderBottom: i === d.items.length - 1 ? undefined : 0, py: 0.4 } }}>
                      <TableCell sx={{ pl: 4 }}>
                        <Typography variant="body2">{e.description}</Typography>
                        <Typography variant="caption" color="text.secondary">{e.category} · {e.paidWith}{e.recordedByName ? ` · by ${e.recordedByName}` : ''}</Typography>
                      </TableCell>
                      <TableCell />
                      <TableCell align="right"><Typography variant="body2">{peso(e.amount)}</Typography></TableCell>
                      <TableCell />
                      <TableCell align="right">
                        <Button size="small" onClick={() => setEdit({ _id: e._id, date: isoDay(e.date), description: e.description, category: e.category, amount: String(e.amount), paidWith: e.paidWith })}>Edit</Button>
                        <Button size="small" color="error" onClick={() => setDel(e)}>Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
              {days.length > 0 && (
                <TableRow sx={{ '& td': { borderTop: `2px solid ${brand.ink}`, fontWeight: 800 } }}>
                  <TableCell>Month total</TableCell>
                  <TableCell align="right">{peso(totals.sales)}</TableCell>
                  <TableCell align="right">{peso(totals.spent)}</TableCell>
                  <TableCell align="right" sx={{ color: netColor(totals.sales - totals.spent) }}>{totals.sales - totals.spent < 0 ? '− ' : ''}{peso(Math.abs(totals.sales - totals.spent))}</TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
          {!days.length && <Empty>{label} has not started yet.</Empty>}
          {days.length > 0 && days.length !== shown.length && (
            <Button size="small" sx={{ mt: 1 }} onClick={() => setShowAll(true)}>Show all {days.length} days (including days with no sales or expenses)</Button>
          )}
        </Box>
      </DataState>
      <Dialog open={!!edit} onClose={keepOpenOnTapOutside(() => setEdit(null))} maxWidth="xs" fullWidth PaperProps={{ component: 'form', onSubmit: save }}>
        <DialogTitle>{edit?._id ? 'Edit expense' : 'Add expense'}</DialogTitle>
        <DialogContent>
          {edit && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="What was paid for" placeholder="e.g. Water jug refill, Meralco bill" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} required />
              <TextField label="Amount (₱)" type="number" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} inputProps={{ min: 0.01, step: '0.01' }} required />
              <TextField label="Date paid" type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} InputLabelProps={{ shrink: true }} inputProps={{ max: isoDay() }} required />
              <TextField select label="Category" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{EXPENSE_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField>
              <TextField select label="Paid with" value={edit.paidWith} onChange={(e) => setEdit({ ...edit, paidWith: e.target.value })}>{PAID_WITH.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy}>Save</Button></DialogActions>
      </Dialog>
      <ConfirmDialog open={!!del} title="Delete this expense?" message={del ? `${del.description} · ${peso(del.amount)} on ${fdate(del.date)}` : ''} confirmLabel="Delete" danger busy={busy} onClose={() => setDel(null)} onConfirm={remove} />
    </Section>
  );
}

function downloadCsv(name, headers, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-${isoDay()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CsvButton({ onClick }) {
  return <Button size="small" variant="outlined" startIcon={<DownloadIcon fontSize="small" />} onClick={onClick}>CSV</Button>;
}

export default function Reports() {
  usePageTitle('Reports & Analytics', 'Descriptive reports on revenue, attendance, members, programs and sales.');
  const thisMonth = dayjs().format('YYYY-MM');
  const [month, setMonth] = useState(thisMonth);
  const r = useFetch('/reports/analytics', { params: { month } });
  const x = r.data;
  const hours = Array.from({ length: 18 }, (_, i) => i + 5);
  const methods = x?.methods || [];
  const shift = (n) => setMonth(dayjs(`${month}-01`).add(n, 'month').format('YYYY-MM'));
  const monthLabel = dayjs(`${month}-01`).format('MMMM YYYY');

  const weekdays = useMemo(() => {
    if (!x) return [];
    const sums = Array(7).fill(0);
    const counts = Array(7).fill(0);
    x.checkins.filter((d) => !dayjs(d.date).isAfter(dayjs(), 'day')).forEach((d) => {
      const w = dayjs(d.date).day();
      sums[w] += d.value;
      counts[w] += 1;
    });
    return sums.map((s, i) => (counts[i] ? Math.round((s / counts[i]) * 10) / 10 : 0));
  }, [x]);

  const revenueRows = () => x.revenue.membership.map((d, i) => {
    const sales = Math.round((d.value + (x.revenue.walkin[i]?.value || 0) + (x.revenue.retail[i]?.value || 0)) * 100) / 100;
    const spent = x.revenue.expenses[i]?.value || 0;
    return [d.date, d.value, x.revenue.walkin[i]?.value || 0, x.revenue.retail[i]?.value || 0, sales, spent, Math.round((sales - spent) * 100) / 100];
  });
  const attendanceRows = () => x.checkins.map((d, i) => [d.date, d.value, x.newMembers[i]?.value || 0]);

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft /></IconButton>
          <TextField type="month" size="small" label="Report month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ max: thisMonth }} sx={{ width: 190 }} />
          <IconButton onClick={() => shift(1)} disabled={month >= thisMonth} aria-label="Next month"><ChevronRight /></IconButton>
          {month !== thisMonth && <Button size="small" onClick={() => setMonth(thisMonth)}>This month</Button>}
        </Stack>
        <Typography variant="caption" color="text.secondary">Showing {monthLabel}. Descriptive reports only, based on recorded data.</Typography>
      </Stack>
      <DataState {...r} onRetry={r.reload}>
        {x && (
          <>
            <ProfitSummary x={x} />
            <Expenses month={month} label={x.label} x={x} onChanged={r.reload} />
            <Grid cols={{ xs: 1, sm: 2, lg: 4 }}>
              <StatCard label="Sales" value={peso0(x.totals.revenue)} sub={`Memberships ${peso0(x.totals.byType.membership)} · Walk-ins ${peso0(x.totals.byType.walkin)} · Products ${peso0(x.totals.byType.retail + x.totals.byType.other)}`} />
              <StatCard label="Check-ins" value={x.totals.checkins} sub={`${(x.totals.checkins / Math.max(x.daysCounted, 1)).toFixed(1)} per day · ${x.totals.walkins} walk-ins (${x.totals.studentWalkins} students)`} />
              <StatCard label="Retention" value={`${x.totals.retention}%`} sub={`${x.totals.currentMembers} of ${x.totals.totalMembers} memberships current today`} />
              <StatCard label="New members" value={x.totals.newMembers} sub={`joined in ${x.label}`} />
            </Grid>
            <Grid cols={{ xs: 1, md: 2 }}>
              <Section
                title={`Daily sales and expenses · ${x.label}`}
                action={<CsvButton onClick={() => downloadCsv(`sales-${month}`, ['Date', 'Memberships', 'Walk-ins', 'Products & other', 'Total sales', 'Expenses', 'Net'], revenueRows())} />}
              >
                <LineChart
                  legend
                  money
                  height={240}
                  labels={x.revenue.membership.map((d) => dayNum(d.date))}
                  series={[
                    { label: 'Memberships', data: x.revenue.membership.map((d) => d.value), color: brand.yellow },
                    { label: 'Walk-ins', data: x.revenue.walkin.map((d) => d.value), color: brand.green },
                    { label: 'Products & other', data: x.revenue.retail.map((d) => d.value), color: brand.orange },
                    { label: 'Expenses', data: x.revenue.expenses.map((d) => d.value), color: brand.red },
                  ]}
                />
              </Section>
              <Section
                title={`Daily check-ins · ${x.label}`}
                action={<CsvButton onClick={() => downloadCsv(`attendance-${month}`, ['Date', 'Check-ins', 'New members'], attendanceRows())} />}
              >
                <BarChart height={240} labels={x.checkins.map((d) => dayNum(d.date))} data={x.checkins.map((d) => d.value)} color={brand.yellow} highlight={x.isCurrentMonth ? x.daysCounted - 1 : undefined} label="Check-ins" />
              </Section>
            </Grid>
            <Grid cols={{ xs: 1, md: 3 }}>
              <Section
                title="Peak hours"
                action={<CsvButton onClick={() => downloadCsv('peak-hours', ['Hour', 'Average check-ins per day'], x.avgByHour.map((v, h) => [`${String(h).padStart(2, '0')}:00`, v]))} />}
              >
                <BarChart height={200} labels={hours.map(hourLabel)} data={hours.map((h) => x.avgByHour[h])} highlight={hours.map((h) => x.avgByHour[h]).indexOf(Math.max(...hours.map((h) => x.avgByHour[h])))} label="Avg check-ins" />
                <Typography variant="caption" color="text.secondary">Average check-ins per day by hour. The darker bar is the busiest hour.</Typography>
              </Section>
              <Section title="Busiest days of the week">
                <BarChart height={200} labels={['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']} data={weekdays} highlight={weekdays.indexOf(Math.max(...weekdays))} label="Avg check-ins" />
                <Typography variant="caption" color="text.secondary">Average check-ins per weekday in {x.label}.</Typography>
              </Section>
              <Section title="Member growth">
                <LineChart height={200} labels={x.newMembers.map((d) => dayNum(d.date))} series={[{ label: 'New members', data: x.newMembers.map((d) => d.value), color: brand.purple, fill: true }]} />
                <Typography variant="caption" color="text.secondary">{x.totals.newMembers} joined · {x.totals.retention}% of all members have a current membership</Typography>
              </Section>
            </Grid>
            <Grid cols={{ xs: 1, md: 2 }}>
              <Section title="Current members by plan" action={x.planDistribution.length > 0 && <CsvButton onClick={() => downloadCsv('members-by-plan', ['Plan', 'Members'], x.planDistribution.map((p) => [p.plan, p.members]))} />}>
                {x.planDistribution.length ? <DonutChart sub="current" segments={x.planDistribution.map((p, i) => ({ label: p.plan, value: p.members, color: COLORS[i % COLORS.length] }))} /> : <Empty>No current members.</Empty>}
              </Section>
              <Section title="Payment methods" action={methods.length > 0 && <CsvButton onClick={() => downloadCsv('payment-methods', ['Method', 'Transactions', 'Amount'], methods.map((m) => [m.method, m.count, Math.round(m.amount * 100) / 100]))} />}>
                <>
                  {methods.length ? (
                    <Stack spacing={1.5}>
                      <DonutChart sub="transactions" segments={methods.map((m) => ({ label: m.method, value: m.count, color: METHOD_COLORS[m.method] || '#888' }))} />
                      <Table size="small">
                        <TableHead><TableRow><TableCell>Method</TableCell><TableCell align="right">Transactions</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
                        <TableBody>{methods.map((m) => <TableRow key={m.method}><TableCell>{m.method}</TableCell><TableCell align="right">{m.count}</TableCell><TableCell align="right">{peso0(m.amount)}</TableCell></TableRow>)}</TableBody>
                      </Table>
                    </Stack>
                  ) : <Empty>No paid transactions in {x.label}.</Empty>}
                </>
              </Section>
            </Grid>
            <Grid cols={{ xs: 1, md: '3fr 2fr' }}>
              <Section
                title="Program popularity"
                action={x.programPerformance.length > 0 && <CsvButton onClick={() => downloadCsv('programs', ['Program', 'Enrolled', 'Capacity', 'Fill %'], x.programPerformance.map((p) => [p.programName, p.enrolled, p.capacity, pct(p.enrolled, p.capacity)]))} />}
              >
                <Stack spacing={1.2}>
                  {x.programPerformance.map((p) => (
                    <Stack key={p.programName} direction="row" spacing={1.5} alignItems="center">
                      <Typography variant="body2" fontWeight={700} sx={{ width: { xs: 120, sm: 180 }, flex: 'none' }} noWrap>{p.programName}</Typography>
                      <Progress value={pct(p.enrolled, p.capacity)} />
                      <Typography variant="caption" sx={{ width: 70, textAlign: 'right', flex: 'none' }}>{p.enrolled}/{p.capacity}</Typography>
                    </Stack>
                  ))}
                  {!x.programPerformance.length && <Empty>No active programs.</Empty>}
                </Stack>
              </Section>
              <Section
                title="Top products"
                action={x.topProducts.length > 0 && <CsvButton onClick={() => downloadCsv('top-products', ['Product', 'Quantity', 'Sales'], x.topProducts.map((p) => [p.name, p.quantity, p.revenue]))} />}
              >
                <Table size="small">
                  <TableHead><TableRow><TableCell>Product</TableCell><TableCell align="right">Qty</TableCell><TableCell align="right">Sales</TableCell></TableRow></TableHead>
                  <TableBody>{x.topProducts.map((p) => <TableRow key={p.name}><TableCell>{p.name}</TableCell><TableCell align="right">{p.quantity}</TableCell><TableCell align="right">{peso0(p.revenue)}</TableCell></TableRow>)}</TableBody>
                </Table>
                {!x.topProducts.length && <Empty>No product sales in {x.label}.</Empty>}
              </Section>
            </Grid>
            <Section
              title="Coach utilization"
              action={x.coachUtilization.length > 0 && <CsvButton onClick={() => downloadCsv('coach-utilization', ['Coach', 'Availability', 'Programs', 'Sessions this week', 'Hours this week', 'Avg fill %'], x.coachUtilization.map((c) => [c.coach, c.availabilityStatus, c.programs, c.sessionsThisWeek, c.hoursThisWeek, c.avgFill]))} />}
            >
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Coach</TableCell><TableCell>Now</TableCell><TableCell align="right">Programs</TableCell><TableCell align="right">Sessions this week</TableCell><TableCell align="right">Hours this week</TableCell><TableCell>Avg. class fill</TableCell></TableRow></TableHead>
                  <TableBody>
                    {x.coachUtilization.map((c) => (
                      <TableRow key={c.coach}>
                        <TableCell><b>{c.coach}</b></TableCell>
                        <TableCell><StatusChip label={c.availabilityStatus || 'Unavailable'} /></TableCell>
                        <TableCell align="right">{c.programs}</TableCell>
                        <TableCell align="right">{c.sessionsThisWeek}</TableCell>
                        <TableCell align="right">{c.hoursThisWeek}</TableCell>
                        <TableCell><Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 130 }}><Progress value={c.avgFill} /><Typography variant="caption">{c.avgFill}%</Typography></Stack></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!x.coachUtilization.length && <Empty>No active coaches.</Empty>}
              </Box>
            </Section>
          </>
        )}
      </DataState>
    </Stack>
  );
}
