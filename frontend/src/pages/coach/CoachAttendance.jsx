import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import dayjs from 'dayjs';
import useFetch from '../../hooks/useFetch';
import { useSocketEvent } from '../../context/SocketContext';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Grid, Section, StatCard, StatusChip, Empty } from '../../components/ui';
import { BarChart } from '../../components/Charts';
import { ftime } from '../../utils/format';
import { brand } from '../../theme';

export default function CoachAttendance() {
  usePageTitle('Attendance', 'View and monitor client check-ins and attendance records.');
  const a = useFetch('/attendance/coach');
  useSocketEvent('busy:update', a.reload);
  const x = a.data;
  const total = x ? x.series.reduce((s, n) => s + n, 0) : 0;
  return (
    <DataState {...a} onRetry={a.reload}>
      {x && (
        <Stack spacing={2}>
          <Grid cols={{ xs: 1, sm: 2, lg: 4 }}>
            <StatCard label="Clients in today" value={new Set(x.today.map((v) => String(v.member))).size} />
            <StatCard label="In the gym now" value={x.today.filter((v) => !v.timeOut).length} />
            <StatCard label="Check-ins (14 days)" value={total} />
            <StatCard label="Avg. per day" value={(total / 14).toFixed(1)} sub={`${x.clientCount} client${x.clientCount === 1 ? '' : 's'}`} />
          </Grid>
          <Grid cols={{ xs: 1, md: 2 }}>
            <Section title="Client check-ins, last 14 days">
              <BarChart labels={x.days.map((d) => dayjs(d).format('MMM D'))} data={x.series} color={brand.yellow} highlight={x.days.length - 1} height={240} label="Check-ins" />
            </Section>
            <Section title="Today">
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Client</TableCell><TableCell>Time in</TableCell><TableCell>Time out</TableCell><TableCell>Method</TableCell></TableRow></TableHead>
                  <TableBody>
                    {x.today.map((v) => (
                      <TableRow key={v._id}>
                        <TableCell><b>{v.name}</b></TableCell>
                        <TableCell>{ftime(v.timeIn)}</TableCell>
                        <TableCell>{v.timeOut ? ftime(v.timeOut) : <StatusChip label="In gym" />}</TableCell>
                        <TableCell><StatusChip label={v.method} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!x.today.length && <Empty>None of your clients have checked in yet today.</Empty>}
              </Box>
            </Section>
          </Grid>
        </Stack>
      )}
    </DataState>
  );
}
