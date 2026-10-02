import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Box, Button, IconButton, Popover, Stack, Typography } from '@mui/material';
import NotificationsNoneOutlined from '@mui/icons-material/NotificationsNoneOutlined';
import api from '../api';
import useFetch from '../hooks/useFetch';
import { useSocketEvent } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { ago } from '../utils/format';
import { brand } from '../theme';
import { Empty } from './ui';

export function linkFor(role, link) {
  if (!link) return null;
  if (role === 'receptionist' && link.startsWith('/admin')) return link.replace('/admin', '/staff');
  return link;
}

export default function NotificationsMenu() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [anchor, setAnchor] = useState(null);
  const { data, reload } = useFetch('/notifications', { params: { limit: 15 } });
  useSocketEvent('notification', reload);
  const unread = data?.unread || 0;

  const readAll = async () => {
    await api.post('/notifications/read-all');
    reload();
  };
  const open = async (n) => {
    if (n.status === 'Unread') await api.patch(`/notifications/${n._id}/read`);
    setAnchor(null);
    reload();
    const to = linkFor(role, n.link);
    if (to) navigate(to);
  };

  return (
    <>
      <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label={`Notifications, ${unread} unread`}>
        <Badge badgeContent={unread} color="secondary"><NotificationsNoneOutlined /></Badge>
      </IconButton>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} slotProps={{ paper: { sx: { width: 360, maxWidth: '92vw', maxHeight: 460, p: 1 } } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1, py: 0.5 }}>
          <Typography fontWeight={800}>Notifications</Typography>
          <Button size="small" onClick={readAll} disabled={!unread}>Mark all read</Button>
        </Stack>
        {data?.items?.length ? data.items.map((n) => (
          <Box key={n._id} onClick={() => open(n)} sx={{ p: 1.2, borderRadius: 2, cursor: 'pointer', bgcolor: n.status === 'Unread' ? brand.yellowSoft : 'transparent', '&:hover': { bgcolor: brand.fill } }}>
            <Typography variant="body2" fontWeight={700}>{n.title}</Typography>
            {n.message && <Typography variant="body2" color="text.secondary">{n.message}</Typography>}
            <Typography variant="caption" color="text.secondary">{ago(n.dateSent)}</Typography>
          </Box>
        )) : <Empty>No notifications yet.</Empty>}
      </Popover>
    </>
  );
}
