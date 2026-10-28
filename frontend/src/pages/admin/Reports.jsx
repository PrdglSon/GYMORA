import { useMemo, useState } from 'react';
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

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const signed = (n) => `${n < 0 ? '− ' : ''}${peso(Math.abs(n))}`;

function dayFigures(x, date, expenses) {
  const i = x.revenue.membership.findIndex((d) => d.date === date);
  const membership = i >= 0 ? x.revenue.membership[i].value : 0;
  const walkin = i >= 0 ? x.revenue.walkin[i]?.value || 0 : 0;
  const retail = i >= 0 ? x.revenue.retail[i]?.value || 0 : 0;
  const items = expenses.filter((e) => isoDay(e.date) === date);
  const sales = r2(membership + walkin + retail);
  const spent = r2(items.reduce((a, e) => a + e.amount, 0));
  return { date, membership, walkin, retail, sales, spent, net: r2(sales - spent), items };
}

function Figure({ label, value, tone, big, op }) {
  const color = { in: brand.green, out: brand.red, net: value >= 0 ? brand.ink : brand.red }[tone];
  return (
    <Box sx={{ position: 'relative', flex: 1, minWidth: { xs: '100%', sm: 0 }, p: { xs: 2, md: 2.5 }, borderRadius: 3, bgcolor: tone === 'net' ? brand.yellowSoft : '#fff', border: `1px solid ${tone === 'net' ? brand.yellow : brand.line}` }}>
      {op && <Box sx={{ position: 'absolute', left: -27, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: '50%', bgcolor: '#fff', border: `1px solid ${brand.line}`, display: { xs: 'none', sm: 'grid' }, placeItems: 'center', fontWeight: 800, color: 'text.secondary', zIndex: 1 }}>{op}</Box>}
      <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800, color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ mt: 0.5, fontWeight: 800, fontSize: big ? { xs: 28, md: 34 } : { xs: 24, md: 28 }, lineHeight: 1.1, color, fontVariantNumeric: 'tabular-nums' }}>{tone === 'net' ? signed(value) : peso(value)}</Typography>
    </Box>
  );
}

function DailySummary({ x, day, setDay, expenses, onAdd, onEdit, onDelete, loading }) {
  const d = dayFigures(x, day, expenses);
  const today = isoDay();
  const first = `${x.month}-01`;
  const last = x.isCurrentMonth ? today : dayjs(first).endOf('month').format('YYYY-MM-DD');
  const move = (n) => setDay(dayjs(day).add(n, 'day').format('YYYY-MM-DD'));
  return (
    <Section
      title="Daily sales and expenses"
      action={(
        <Stack direction="row" spacing={0.5} alignItems="center">
          <IconButton size="small" onClick={() => move(-1)} aria-label="Previous day"><ChevronLeft /></IconButton>
          <TextField type="date" size="small" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} inputProps={{ max: today, 'aria-label': 'Day' }} sx={{ width: 165 }} />
          <IconButton size="small" onClick={() => move(1)} disabled={day >= today} aria-label="Next day"><ChevronRight /></IconButton>
          {day !== today && <Button size="small" onClick={() => setDay(today)}>Today</Button>}
        </Stack>
      )}
    >
      <Typography variant="h6" sx={{ mb: 2 }}>
        {dayjs(day).format('dddd, MMMM D, YYYY')}
        {day === today && <Box component="span" sx={{ ml: 1, px: 1, py: 0.2, borderRadius: 1, bgcolor: brand.yellow, color: '#fff', fontSize: 12, fontWeight: 800, verticalAlign: 'middle' }}>TODAY</Box>}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.5, sm: 3 }}>
        <Figure label="Total sales" value={d.sales} tone="in" />
        <Figure label="Total expenses" value={d.spent} tone="out" op="−" />
        <Figure label={d.net >= 0 ? 'Net income' : 'Net loss'} value={d.net} tone="net" op="=" big />
      </Stack>
      <Grid cols={{ xs: 1, md: 2 }} gap={3} sx={{ mt: 3 }}>
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{day === today ? 'Sales today' : 'Sales this day'}</Typography>
          <Table size="small">
            <TableBody>
              {[['Memberships', d.membership], ['Walk-in day passes', d.walkin], ['Products and other', d.retail]].map(([k, v]) => (
                <TableRow key={k}><TableCell sx={{ pl: 0 }}>{k}</TableCell><TableCell align="right" sx={{ pr: 0 }}>{peso(v)}</TableCell></TableRow>
              ))}
              <TableRow><TableCell sx={{ pl: 0, fontWeight: 800, borderBottom: 0 }}>Total sales</TableCell><TableCell align="right" sx={{ pr: 0, fontWeight: 800, borderBottom: 0 }}>{peso(d.sales)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </Box>
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">{day === today ? 'Expenses today' : 'Expenses this day'}</Typography>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => onAdd(day)}>Add expense</Button>
          </Stack>
          {loading ? <Typography variant="body2" color="text.secondary">Loading…</Typography> : d.items.length ? (
            <Table size="small">
              <TableBody>
                {d.items.map((e) => (
                  <TableRow key={e._id}>
                    <TableCell sx={{ pl: 0 }}>
                      <Typography variant="body2" fontWeight={700}>{e.description}</Typography>
                      <Typography variant="caption" color="text.secondary">{e.category} · {e.paidWith}</Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{peso(e.amount)}</TableCell>
                    <TableCell align="right" sx={{ pr: 0, whiteSpace: 'nowrap' }}>
                      <Button size="small" onClick={() => onEdit(e)}>Edit</Button>
                      <Button size="small" color="error" onClick={() => onDelete(e)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow><TableCell sx={{ pl: 0, fontWeight: 800, borderBottom: 0 }}>Total expenses</TableCell><TableCell align="right" sx={{ fontWeight: 800, borderBottom: 0 }}>{peso(d.spent)}</TableCell><TableCell sx={{ borderBottom: 0 }} /></TableRow>
              </TableBody>
            </Table>
          ) : (
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: brand.fill, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">No expenses recorded for this day.</Typography>
            </Box>
          )}
        </Box>
      </Grid>
      {(day < first || day > last) && <Typography variant="caption" color="text.secondary">Loading the month for this day…</Typography>}
    </Section>
  );
}

function MonthOverview({ x }) {
  const p = x.profit;
  const prev = p.previous;
  const change = r2(p.net - prev.net);
  const hasPrev = prev.sales || prev.expenses;
  const tile = (label, value, color, sub) => (
    <Box sx={{ p: 2, borderRadius: 3, border: `1px solid ${brand.line}`, bgcolor: '#fff' }}>
      <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800, color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ mt: 0.5, fontWeight: 800, fontSize: 24, color, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Box>
  );
  return (
    <Section title={`Monthly overview · ${x.label}`}>
      <Grid cols={{ xs: 1, sm: 3 }}>
        {tile('Total sales', peso(p.sales), brand.green, hasPrev ? `${prev.label}: ${peso(prev.sales)}` : null)}
        {tile('Total expenses', peso(p.expenses), brand.red, hasPrev ? `${prev.label}: ${peso(prev.expenses)}` : null)}
        {tile(p.net >= 0 ? 'Net income' : 'Net loss', signed(p.net), p.net >= 0 ? brand.ink : brand.red, hasPrev ? `${change >= 0 ? '▲' : '▼'} ${peso(Math.abs(change))} vs ${prev.label}` : null)}
      </Grid>
      {x.isCurrentMonth && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>Month to date, up to today.</Typography>}
    </Section>
  );
}

function DayByDay({ x, expenses, day, setDay, month }) {
  const [showAll, setShowAll] = useState(false);
  const today = isoDay();
  const days = x.revenue.membership.map((d) => dayFigures(x, d.date, expenses)).filter((d) => d.date <= today).reverse();
  const shown = showAll ? days : days.filter((d) => d.sales || d.spent || d.date === today);
  const totals = days.reduce((a, d) => ({ sales: a.sales + d.sales, spent: a.spent + d.spent }), { sales: 0, spent: 0 });
  const net = r2(totals.sales - totals.spent);
  const csv = () => downloadCsv(`daily-sales-expenses-${month}`, ['Date', 'Sales', 'Expenses', 'Net', 'Expense details'], days.slice().reverse().map((d) => [d.date, d.sales, d.spent, d.net, d.items.map((e) => `${e.description} (${e.amount})`).join('; ')]));
  return (
    <Section title={`Every day in ${x.label}`} action={days.length > 0 && <CsvButton onClick={csv} />}>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
          <TableHead><TableRow><TableCell>Day</TableCell><TableCell align="right">Sales</TableCell><TableCell align="right">Expenses</TableCell><TableCell align="right">Net</TableCell></TableRow></TableHead>
          <TableBody>
            {shown.map((d) => (
              <TableRow key={d.date} hover selected={d.date === day} onClick={() => { setDay(d.date); window.scrollTo({ top: 0, behavior: 'smooth' }); }} sx={{ cursor: 'pointer' }}>
                <TableCell>{dayjs(d.date).format('ddd, MMM D')}{d.date === today && <Typography component="span" variant="caption" sx={{ ml: 1, fontWeight: 800, color: brand.yellowInk }}>TODAY</Typography>}</TableCell>
                <TableCell align="right">{peso(d.sales)}</TableCell>
                <TableCell align="right">{d.spent ? peso(d.spent) : '—'}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, color: d.net >= 0 ? brand.green : brand.red }}>{signed(d.net)}</TableCell>
              </TableRow>
            ))}
            {days.length > 0 && (
              <TableRow sx={{ '& td': { borderTop: `2px solid ${brand.ink}`, fontWeight: 800, borderBottom: 0 } }}>
                <TableCell>Month total</TableCell><TableCell align="right">{peso(totals.sales)}</TableCell><TableCell align="right">{peso(totals.spent)}</TableCell>
                <TableCell align="right" sx={{ color: net >= 0 ? brand.green : brand.red }}>{signed(net)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {days.length !== shown.length && <Button size="small" sx={{ mt: 1 }} onClick={() => setShowAll(true)}>Show all {days.length} days</Button>}
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>Click a day to see its details at the top.</Typography>
      </Box>
    </Section>
  );
}

function ExpenseDialog({ edit, setEdit, onSaved }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { date: edit.date, description: edit.description, category: edit.category, amount: edit.amount, paidWith: edit.paidWith };
      if (edit._id) await api.patch(`/expenses/${edit._id}`, body);
      else await api.post('/expenses', body);
      toast(edit._id ? 'Expense updated' : 'Expense added');
      setEdit(null);
      onSaved();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={!!edit} onClose={keepOpenOnTapOutside(() => setEdit(null))} maxWidth="xs" fullWidth PaperProps={{ component: 'form', onSubmit: save }}>
      <DialogTitle>{edit?._id ? 'Edit expense' : 'Add expense'}</DialogTitle>
      <DialogContent>
        {edit && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="What was paid for" placeholder="e.g. Water jug refill, electric bill" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} required autoFocus />
            <TextField label="Amount (₱)" type="number" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} inputProps={{ min: 0.01, step: '0.01' }} required />
            <TextField label="Date paid" type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} InputLabelProps={{ shrink: true }} inputProps={{ max: isoDay() }} required />
            <TextField select label="Category" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{EXPENSE_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField>
            <TextField select label="Paid with" value={edit.paidWith} onChange={(e) => setEdit({ ...edit, paidWith: e.target.value })}>{PAID_WITH.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy}>Save</Button></DialogActions>
    </Dialog>
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
  const toast = useToast();
  const thisMonth = dayjs().format('YYYY-MM');
  const [day, setDayRaw] = useState(isoDay());
  const month = day.slice(0, 7);
  const setDay = (v) => setDayRaw(v > isoDay() ? isoDay() : v);
  const setMonth = (m) => setDayRaw(m === thisMonth ? isoDay() : dayjs(`${m}-01`).endOf('month').format('YYYY-MM-DD'));
  const r = useFetch('/reports/analytics', { params: { month } });
  const exp = useFetch('/expenses', { params: { month } });
  const expenses = exp.data?.items || [];
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [busyDel, setBusyDel] = useState(false);
  const reloadMoney = () => {
    exp.reload();
    r.reload();
  };
  const blankExpense = (date) => ({ date, description: '', category: 'Supplies (water, cleaning, toiletries)', amount: '', paidWith: 'Cash' });
  const removeExpense = async () => {
    setBusyDel(true);
    try {
      await api.delete(`/expenses/${del._id}`);
      toast('Expense deleted');
      setDel(null);
      reloadMoney();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusyDel(false);
    }
  };
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
      <ExpenseDialog edit={edit} setEdit={setEdit} onSaved={reloadMoney} />
      <ConfirmDialog open={!!del} title="Delete this expense?" message={del ? `${del.description} · ${peso(del.amount)} on ${fdate(del.date)}` : ''} confirmLabel="Delete" danger busy={busyDel} onClose={() => setDel(null)} onConfirm={removeExpense} />
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
            <DailySummary x={x} day={day} setDay={setDay} expenses={expenses} loading={exp.loading && !exp.data} onAdd={(d) => setEdit(blankExpense(d))} onEdit={(e) => setEdit({ _id: e._id, date: isoDay(e.date), description: e.description, category: e.category, amount: String(e.amount), paidWith: e.paidWith })} onDelete={setDel} />
            <MonthOverview x={x} />
            <DayByDay x={x} expenses={expenses} day={day} setDay={setDay} month={month} />
            <Typography variant="overline" sx={{ display: 'block', pt: 1, color: 'text.secondary', fontWeight: 800 }}>Gym analytics · {x.label}</Typography>
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
