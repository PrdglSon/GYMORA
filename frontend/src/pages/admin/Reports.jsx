import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Box, Button, Stack, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import useFetch from '../../hooks/useFetch';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Grid, Section, StatCard, StatusChip, Progress, Empty } from '../../components/ui';
import { LineChart, BarChart, DonutChart } from '../../components/Charts';
import { peso0, fdm, hourLabel, pct, isoDay } from '../../utils/format';
import { brand } from '../../theme';

const COLORS = [brand.yellow, brand.orange, brand.green, brand.blue, brand.purple, '#888'];
const METHOD_COLORS = { Cash: brand.green, GCash: brand.blue, Card: brand.purple, Other: '#888' };

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
  const [days, setDays] = useState(30);
  const from = dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD');
  const r = useFetch('/reports/analytics', { params: { days } });
  const pays = useFetch('/payments', { params: { status: 'Paid', from, limit: 200 } });
  const pos = useFetch('/pos/transactions', { params: { days, limit: 200 } });
  const x = r.data;
  const hours = Array.from({ length: 18 }, (_, i) => i + 5);

  const methods = useMemo(() => {
    const totals = {};
    const add = (m, amt) => {
      const k = m && m !== 'Unpaid' ? m : 'Other';
      totals[k] = totals[k] || { method: k, count: 0, amount: 0 };
      totals[k].count += 1;
      totals[k].amount += Number(amt) || 0;
    };
    (pays.data?.items || []).forEach((p) => add(p.paymentMethod, p.amount));
    (pos.data?.items || []).filter((t) => t.status === 'Completed' && t.productAmount > 0).forEach((t) => add(t.paymentMethod, t.productAmount));
    return Object.values(totals).sort((a, b) => b.amount - a.amount);
  }, [pays.data, pos.data]);
  const methodsPartial = (pays.data && pays.data.total > (pays.data.items || []).length) || (pos.data && pos.data.total > (pos.data.items || []).length);

  const weekdays = useMemo(() => {
    if (!x) return [];
    const sums = Array(7).fill(0);
    const counts = Array(7).fill(0);
    x.checkins.forEach((d) => {
      const w = dayjs(d.date).day();
      sums[w] += d.value;
      counts[w] += 1;
    });
    return sums.map((s, i) => (counts[i] ? Math.round((s / counts[i]) * 10) / 10 : 0));
  }, [x]);

  const revenueRows = () => x.revenue.membership.map((d, i) => [d.date, d.value, x.revenue.walkin[i]?.value || 0, x.revenue.retail[i]?.value || 0, Math.round((d.value + (x.revenue.walkin[i]?.value || 0) + (x.revenue.retail[i]?.value || 0)) * 100) / 100]);
  const attendanceRows = () => x.checkins.map((d, i) => [d.date, d.value, x.newMembers[i]?.value || 0]);

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap spacing={1}>
        <ToggleButtonGroup exclusive size="small" value={days} onChange={(_, v) => v && setDays(v)}>
          {[7, 30, 90, 365].map((d) => <ToggleButton key={d} value={d}>{d === 365 ? '1 year' : `Last ${d} days`}</ToggleButton>)}
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary">Descriptive reports only, based on recorded data. No forecasting.</Typography>
      </Stack>
      <DataState {...r} onRetry={r.reload}>
        {x && (
          <>
            <Grid cols={{ xs: 1, sm: 2, lg: 4 }}>
              <StatCard label="Revenue" value={peso0(x.totals.revenue)} sub={`Memberships ${peso0(x.totals.byType.membership)} · Walk-ins ${peso0(x.totals.byType.walkin)} · Products ${peso0(x.totals.byType.retail + x.totals.byType.other)}`} />
              <StatCard label="Check-ins" value={x.totals.checkins} sub={`${(x.totals.checkins / x.days).toFixed(1)} per day · ${x.totals.walkins} walk-ins`} />
              <StatCard label="Retention" value={`${x.totals.retention}%`} sub={`${x.totals.currentMembers} of ${x.totals.totalMembers} memberships current`} />
              <StatCard label="New members" value={x.totals.newMembers} sub={`in the last ${x.days} days`} />
            </Grid>
            <Grid cols={{ xs: 1, md: 2 }}>
              <Section
                title="Revenue by source"
                action={<CsvButton onClick={() => downloadCsv('revenue', ['Date', 'Memberships', 'Walk-ins', 'Products & other', 'Total'], revenueRows())} />}
              >
                <LineChart
                  legend
                  money
                  height={240}
                  labels={x.revenue.membership.map((d) => fdm(d.date))}
                  series={[
                    { label: 'Memberships', data: x.revenue.membership.map((d) => d.value), color: brand.yellow },
                    { label: 'Walk-ins', data: x.revenue.walkin.map((d) => d.value), color: brand.green },
                    { label: 'Products & other', data: x.revenue.retail.map((d) => d.value), color: brand.orange },
                  ]}
                />
              </Section>
              <Section
                title="Attendance trend"
                action={<CsvButton onClick={() => downloadCsv('attendance', ['Date', 'Check-ins', 'New members'], attendanceRows())} />}
              >
                <BarChart height={240} labels={x.checkins.map((d) => fdm(d.date))} data={x.checkins.map((d) => d.value)} color={brand.yellow} highlight={x.checkins.length - 1} label="Check-ins" />
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
                <Typography variant="caption" color="text.secondary">Average check-ins per weekday in this period.</Typography>
              </Section>
              <Section title="Member growth">
                <LineChart height={200} labels={x.newMembers.map((d) => fdm(d.date))} series={[{ label: 'New members', data: x.newMembers.map((d) => d.value), color: brand.purple, fill: true }]} />
                <Typography variant="caption" color="text.secondary">{x.totals.newMembers} joined · {x.totals.retention}% of all members have a current membership</Typography>
              </Section>
            </Grid>
            <Grid cols={{ xs: 1, md: 2 }}>
              <Section title="Current members by plan" action={x.planDistribution.length > 0 && <CsvButton onClick={() => downloadCsv('members-by-plan', ['Plan', 'Members'], x.planDistribution.map((p) => [p.plan, p.members]))} />}>
                {x.planDistribution.length ? <DonutChart sub="current" segments={x.planDistribution.map((p, i) => ({ label: p.plan, value: p.members, color: COLORS[i % COLORS.length] }))} /> : <Empty>No current members.</Empty>}
              </Section>
              <Section title="Payment methods" action={methods.length > 0 && <CsvButton onClick={() => downloadCsv('payment-methods', ['Method', 'Transactions', 'Amount'], methods.map((m) => [m.method, m.count, Math.round(m.amount * 100) / 100]))} />}>
                <DataState loading={pays.loading || pos.loading} error={pays.error || pos.error} data={pays.data && pos.data} onRetry={() => { pays.reload(); pos.reload(); }}>
                  {methods.length ? (
                    <Stack spacing={1.5}>
                      <DonutChart sub="transactions" segments={methods.map((m) => ({ label: m.method, value: m.count, color: METHOD_COLORS[m.method] || '#888' }))} />
                      <Table size="small">
                        <TableHead><TableRow><TableCell>Method</TableCell><TableCell align="right">Transactions</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
                        <TableBody>{methods.map((m) => <TableRow key={m.method}><TableCell>{m.method}</TableCell><TableCell align="right">{m.count}</TableCell><TableCell align="right">{peso0(m.amount)}</TableCell></TableRow>)}</TableBody>
                      </Table>
                      {methodsPartial && <Typography variant="caption" color="text.secondary">Based on the latest 200 payments and 200 sales in this period.</Typography>}
                    </Stack>
                  ) : <Empty>No paid transactions in this period.</Empty>}
                </DataState>
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
                {!x.topProducts.length && <Empty>No product sales in this period.</Empty>}
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
