import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Stack, Tab, Tabs, Typography } from '@mui/material';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../context/SocketContext';
import { usePageTitle } from '../../components/AppShell';
import { linkFor } from '../../components/NotificationsMenu';
import { DataState, Section, Empty, StatusChip } from '../../components/ui';
import { ago, fdt } from '../../utils/format';
import { brand } from '../../theme';

export default function Notifications() {
  usePageTitle('Notifications', 'Stay updated with important alerts and reminders.');
  const navigate = useNavigate();
  const { role } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('All');
  const n = useFetch('/notifications', { params: { limit: 100 } });
  useSocketEvent('notification', n.reload);
  const items = (n.data?.items || []).filter((x) => tab === 'All' || x.status === 'Unread');

  const readAll = async () => {
    try {
      await api.post('/notifications/read-all');
      n.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };
  const open = async (x) => {
    try {
      if (x.status === 'Unread') await api.patch(`/notifications/${x._id}/read`);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
    const to = linkFor(role, x.link);
    if (to) navigate(to);
    else n.reload();
  };

  return (
    <Section title="All notifications" action={<Button variant="outlined" size="small" onClick={readAll} disabled={!n.data?.unread}>Mark all as read</Button>}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1.5 }}>
        <Tab value="All" label="All" />
        <Tab value="Unread" label={`Unread${n.data?.unread ? ` (${n.data.unread})` : ''}`} />
      </Tabs>
      <DataState {...n} onRetry={n.reload}>
        <Stack spacing={1}>
          {items.map((x) => (
            <Box key={x._id} onClick={() => open(x)} sx={{ p: 1.5, borderRadius: 2, cursor: 'pointer', bgcolor: x.status === 'Unread' ? brand.yellowSoft : '#fff', border: 1, borderColor: x.status === 'Unread' ? brand.yellow : 'divider', display: 'flex', justifyContent: 'space-between', gap: 2, '&:hover': { bgcolor: x.status === 'Unread' ? brand.yellowSoft : brand.fill } }}>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.3 }}>
                  <Typography variant="body2" fontWeight={x.status === 'Unread' ? 800 : 700}>{x.title}</Typography>
                  {x.notificationType && x.notificationType !== 'General' && <StatusChip label={x.notificationType} color="grey" />}
                </Stack>
                {x.message && <Typography variant="body2" color="text.secondary">{x.message}</Typography>}
              </Box>
              <Stack alignItems="flex-end" spacing={0.5} sx={{ flex: 'none' }}>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }} title={fdt(x.dateSent)}>{ago(x.dateSent)}</Typography>
                <StatusChip label={x.status} />
              </Stack>
            </Box>
          ))}
          {!items.length && <Empty>{tab === 'Unread' ? 'You are all caught up.' : 'No notifications yet.'}</Empty>}
        </Stack>
      </DataState>
    </Section>
  );
}
