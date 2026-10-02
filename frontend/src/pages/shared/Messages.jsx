import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Box, Button, Card, Stack, TextField, Typography, useMediaQuery } from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../context/SocketContext';
import { usePageTitle } from '../../components/AppShell';
import { UserAvatar, Empty, Loading } from '../../components/ui';
import { ago, fdt } from '../../utils/format';
import { brand } from '../../theme';

export default function Messages() {
  const { role } = useAuth();
  const coach = role === 'coach';
  usePageTitle('Messages', coach ? 'Send messages to your clients and review conversations.' : 'Send messages to your coaches.');
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const threads = useFetch('/messages/threads', { initial: [] });
  const [active, setActive] = useState(params.get('to'));
  const convo = useFetch(active ? `/messages/${active}` : null, { initial: [] });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const bottom = useRef(null);
  const narrow = useMediaQuery('(max-width:700px)');
  const myType = coach ? 'Coach' : 'Member';

  useEffect(() => {
    if (!active && threads.data?.length && !narrow) setActive(String(threads.data[0].id));
  }, [threads.data, active, narrow]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [convo.data]);
  useEffect(() => {
    if (active && convo.data) threads.reload();
  }, [convo.data]);
  useSocketEvent('notification', (n) => {
    if (n?.notificationType === 'Message') {
      threads.reload();
      if (active) convo.reload();
    }
  });

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api.post(`/messages/${active}`, { content: text.trim() });
      setText('');
      convo.reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const open = (id) => {
    setActive(String(id));
    setParams({ to: id });
  };
  const back = () => {
    setActive(null);
    setParams({});
  };
  const other = threads.data?.find((t) => String(t.id) === String(active));
  const showList = !narrow || !active;
  const showConvo = !narrow || !!active;

  return (
    <Card sx={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '300px 1fr', minHeight: 520 }}>
      {showList && (
        <Box sx={{ borderRight: narrow ? 0 : 1, borderColor: 'divider', p: 1, overflowY: 'auto', maxHeight: 660 }}>
          <Typography variant="h6" sx={{ px: 1, py: 1 }}>{coach ? 'Clients' : 'Coaches'}</Typography>
          {threads.loading && !threads.data?.length ? <Loading /> : threads.data?.length ? threads.data.map((t) => (
            <Box key={t.id} onClick={() => open(t.id)} sx={{ display: 'flex', gap: 1.2, p: 1.2, borderRadius: 2, cursor: 'pointer', bgcolor: String(t.id) === String(active) ? brand.yellowSoft : 'transparent', '&:hover': { bgcolor: String(t.id) === String(active) ? brand.yellowSoft : brand.fill } }}>
              <Badge color="secondary" badgeContent={t.unread} overlap="circular"><UserAvatar name={t.name} src={t.avatarUrl} /></Badge>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography variant="body2" fontWeight={t.unread ? 800 : 700} noWrap>{t.name}</Typography>
                  {t.last && <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{ago(t.last.createdAt)}</Typography>}
                </Stack>
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  {t.last ? `${t.last.senderType === myType ? 'You: ' : ''}${t.last.content}` : t.sub || 'No messages yet'}
                </Typography>
              </Box>
            </Box>
          )) : <Empty>{coach ? 'Clients appear here once they enroll in your programs or choose you as their coach.' : 'Choose a coach or enroll in a program to message a coach.'}</Empty>}
        </Box>
      )}
      {showConvo && (
        <Stack sx={{ minWidth: 0 }}>
          {active ? (
            <>
              <Stack direction="row" spacing={1.2} alignItems="center" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                {narrow && <Button size="small" startIcon={<ArrowBack />} onClick={back}>Back</Button>}
                <UserAvatar name={other?.name} src={other?.avatarUrl} size={30} />
                <Box>
                  <Typography fontWeight={800} lineHeight={1.2}>{other?.name || 'Conversation'}</Typography>
                  {other?.sub && <Typography variant="caption" color="text.secondary">{other.sub}</Typography>}
                </Box>
              </Stack>
              <Stack spacing={1} sx={{ flex: 1, p: 2, overflowY: 'auto', maxHeight: 520 }}>
                {convo.loading && !convo.data?.length ? <Loading /> : convo.error ? <Typography color="error" variant="body2">{convo.error}</Typography> : convo.data?.length ? convo.data.map((m) => {
                  const mine = m.senderType === myType;
                  return (
                    <Box key={m._id} sx={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '75%', bgcolor: mine ? brand.yellow : brand.fill, color: mine ? '#fff' : brand.ink, px: 1.5, py: 1, borderRadius: 3 }}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.8 }} title={fdt(m.createdAt)}>{ago(m.createdAt)}{mine && m.readAt ? ' · Read' : ''}</Typography>
                    </Box>
                  );
                }) : <Empty>No messages yet. Say hi!</Empty>}
                <div ref={bottom} />
              </Stack>
              <Stack component="form" direction="row" spacing={1} sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }} onSubmit={send}>
                <TextField placeholder="Write a message…" value={text} onChange={(e) => setText(e.target.value)} multiline maxRows={4} inputProps={{ maxLength: 1000, 'aria-label': 'Message' }} />
                <Button type="submit" variant="contained" disabled={busy || !text.trim()}>Send</Button>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, pb: 1 }}>The recipient is notified of new messages. This is an inbox, not live chat.</Typography>
            </>
          ) : <Empty>Choose a conversation.</Empty>}
        </Stack>
      )}
    </Card>
  );
}
