import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Box, Button, Chip, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import useFetch from '../../hooks/useFetch';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Section, Empty } from '../../components/ui';
import { fdt } from '../../utils/format';

const LIMIT = 200;
const ROLE_LABEL = { admin: 'Administrator', receptionist: 'Staff', coach: 'Coach', member: 'Member', platform: 'Platform Admin', system: 'System' };

export default function AuditLogs() {
  usePageTitle('Audit Logs', 'Track system activities and changes made by users.');
  const [module, setModule] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);
  const a = useFetch('/audit', { params: { module: module || undefined, q: q || undefined, page, limit: LIMIT } });
  const items = useMemo(() => (a.data?.items || []).filter((x) => {
    const d = dayjs(x.createdAt);
    if (from && d.isBefore(dayjs(from).startOf('day'))) return false;
    if (to && d.isAfter(dayjs(to).endOf('day'))) return false;
    return true;
  }), [a.data, from, to]);
  const clear = () => {
    setModule('');
    setSearch('');
    setQ('');
    setFrom('');
    setTo('');
    setPage(1);
  };
  return (
    <Section>
      <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap alignItems="center">
        <TextField placeholder="Search action or user…" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ width: 240 }} inputProps={{ 'aria-label': 'Search' }} />
        <TextField select value={module} onChange={(e) => { setModule(e.target.value); setPage(1); }} sx={{ width: 230 }} SelectProps={{ displayEmpty: true }} inputProps={{ 'aria-label': 'Module' }}>
          <MenuItem value="">All modules</MenuItem>
          {(a.data?.modules || []).slice().sort().map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
        </TextField>
        <TextField type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
        <TextField type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
        {(module || search || from || to) && <Button size="small" onClick={clear}>Clear filters</Button>}
      </Stack>
      <DataState {...a} onRetry={a.reload}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>Date & time</TableCell><TableCell>User</TableCell><TableCell>Role</TableCell><TableCell>Module</TableCell><TableCell>Action</TableCell></TableRow></TableHead>
            <TableBody>
              {items.map((x) => (
                <TableRow key={x._id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{fdt(x.createdAt)}</TableCell>
                  <TableCell><b>{x.actorName || 'System'}</b></TableCell>
                  <TableCell>{ROLE_LABEL[x.role] || x.role || x.actorType || '—'}</TableCell>
                  <TableCell><Chip size="small" label={x.module} /></TableCell>
                  <TableCell>{x.action}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!items.length && <Empty>No activity recorded{from || to ? ' for these dates on this page' : ''}.</Empty>}
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {from || to ? `${items.length} shown on this page · ` : ''}{a.data?.total ?? 0} entries · page {page}
          </Typography>
          <Button size="small" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button size="small" disabled={!a.data || page * LIMIT >= a.data.total} onClick={() => setPage(page + 1)}>Next</Button>
        </Stack>
      </DataState>
    </Section>
  );
}
