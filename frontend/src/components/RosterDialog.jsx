import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import useFetch from '../hooks/useFetch';
import { DataState, StatusChip, Empty, UserAvatar } from './ui';
import { ftime, fdate } from '../utils/format';

export default function RosterDialog({ open, onClose, program }) {
  const id = open && program ? program._id || program.programId : null;
  const r = useFetch(id ? `/programs/${id}/roster` : null);
  const p = r.data?.program;
  const members = r.data?.members || [];
  const inToday = members.filter((m) => m.todayVisit).length;
  return (
    <Dialog open={!!open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{p?.programName || program?.programName || 'Roster'}</DialogTitle>
      <DialogContent>
        <DataState loading={r.loading} error={r.error} data={r.data} onRetry={r.reload}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {[p?.schedule, `${members.length}/${p?.capacity ?? '—'} enrolled`, `${inToday} checked in today`].filter(Boolean).join(' · ')}
          </Typography>
          {members.length ? (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead><TableRow><TableCell>Member</TableCell><TableCell>Membership</TableCell><TableCell>Enrolled</TableCell><TableCell>Today</TableCell></TableRow></TableHead>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m._id}>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <UserAvatar name={m.name} src={m.avatarUrl} size={28} />
                          <Box><Typography variant="body2" fontWeight={700}>{m.name}</Typography><Typography variant="caption" color="text.secondary">{m.memberCode}</Typography></Box>
                        </Stack>
                      </TableCell>
                      <TableCell><StatusChip label={m.status} /></TableCell>
                      <TableCell>{fdate(m.enrollmentDate)}</TableCell>
                      <TableCell>{m.todayVisit ? <StatusChip label={`In ${ftime(m.todayVisit.timeIn)}`} color="green" /> : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          ) : <Empty>No one is enrolled yet.</Empty>}
        </DataState>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}
