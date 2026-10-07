import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, MenuItem, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PrintIcon from '@mui/icons-material/PrintOutlined';
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined';
import api, { errMsg } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../context/SocketContext';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Grid, Section, StatCard, StatusChip, Empty } from '../../components/ui';
import { fdate, fdt, peso, peso0 } from '../../utils/format';
import { brand } from '../../theme';
import { NameField } from '../../components/ContactFields';

const CHANNEL = { card: 'Card', gcash: 'GCash', paymaya: 'Maya', grab_pay: 'GrabPay', qrph: 'QR Ph' };
const TABS = [['all', 'All'], ['Membership', 'Membership'], ['Walk-in', 'Walk-in'], ['Other', 'Other'], ['Unpaid', 'Unpaid'], ['Void', 'Void']];
const METHODS = ['Cash', 'GCash', 'Card', 'Other'];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function printReceipt(gym, p) {
  const w = window.open('', '_blank', 'width=380,height=600');
  if (!w) return false;
  const row = (a, b) => `<tr><td>${esc(a)}</td><td style="text-align:right">${esc(b)}</td></tr>`;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.receiptNo)}</title><style>body{font-family:monospace;font-size:12px;padding:12px;max-width:300px;margin:auto}h3,p{text-align:center;margin:4px 0}table{width:100%;border-collapse:collapse}td{padding:2px 0}hr{border:none;border-top:1px dashed #000}</style></head><body>
<h3>${esc(gym?.name)}</h3><p>${esc(gym?.address || '')}</p><hr/>
<table>${row('Receipt', p.receiptNo)}${row('Date', fdt(p.paymentDate || p.createdAt))}${row('Payer', p.payerName)}${p.member?.memberCode ? row('Member ID', p.member.memberCode) : ''}${row('Type', p.paymentType)}</table><hr/>
<table>${row(p.description, peso(p.amount))}</table><hr/>
<table>${row('TOTAL', peso(p.amount))}${row('Method', p.paymentMethod)}${p.referenceNumber ? row('Reference', p.referenceNumber) : ''}${row('Status', p.status)}</table><hr/>
<p>Thank you!</p><script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
  return true;
}

function ReceiptDialog({ payment: p, gym, onClose }) {
  const toast = useToast();
  const line = (a, b, bold) => <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color={bold ? 'text.primary' : 'text.secondary'} fontWeight={bold ? 800 : 400}>{a}</Typography><Typography variant="body2" fontWeight={bold ? 800 : 600}>{b}</Typography></Stack>;
  return (
    <Dialog open={!!p} onClose={onClose} maxWidth="xs" fullWidth>
      {p && (
        <>
          <DialogTitle sx={{ textAlign: 'center' }}>{gym?.name}<Typography variant="caption" display="block" color="text.secondary">Official receipt</Typography></DialogTitle>
          <DialogContent>
            <Stack spacing={0.8}>
              {line('Receipt', p.receiptNo)}
              {line('Date', fdt(p.paymentDate || p.createdAt))}
              {line('Payer', p.payerName)}
              {p.member?.memberCode && line('Member ID', p.member.memberCode)}
              {line('Type', p.paymentType)}
              <Divider sx={{ borderStyle: 'dashed' }} />
              {line(p.description, peso(p.amount))}
              <Divider sx={{ borderStyle: 'dashed' }} />
              {line('Total', peso(p.amount), true)}
              {line('Method', p.paymentMethod)}
              {p.referenceNumber && line('Reference', p.referenceNumber)}
              {p.recordedBy && line('Recorded by', `${p.recordedBy.firstName || ''} ${p.recordedBy.lastName || ''}`.trim())}
              <Stack direction="row" justifyContent="center" sx={{ pt: 1 }}><StatusChip label={p.status} /></Stack>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button variant="outlined" onClick={onClose}>Close</Button>
            <Button variant="contained" startIcon={<PrintIcon />} onClick={() => printReceipt(gym, p) || toast('Allow pop-ups to print receipts.', 'error')}>Print</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

export default function Billing() {
  usePageTitle('Payments & Billing', 'Track payments, manage invoices and monitor revenue.');
  const { role, gym } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('status') === 'Unpaid' ? 'Unpaid' : 'all');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const isStatus = ['Unpaid', 'Void'].includes(tab);
  const query = { q: q || undefined, from: from || undefined, to: to || undefined, limit: 100, ...(isStatus ? { status: tab } : tab !== 'all' ? { paymentType: tab } : {}) };
  const list = useFetch('/payments', { params: query });
  const sum = useFetch('/payments/summary');
  const [settle, setSettle] = useState(null);
  const [settleF, setSettleF] = useState({ paymentMethod: 'Cash', referenceNumber: '' });
  const emptyO = { payerName: '', description: '', amount: '', paymentMethod: 'Cash', referenceNumber: '' };
  const [other, setOther] = useState(false);
  const [o, setO] = useState(emptyO);
  const [voiding, setVoiding] = useState(null);
  const [reason, setReason] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);
  const reload = () => {
    list.reload();
    sum.reload();
  };
  useSocketEvent('payments:update', reload);

  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const doSettle = (e) => {
    e.preventDefault();
    act(async () => {
      const { data } = await api.post(`/payments/${settle._id}/settle`, { paymentMethod: settleF.paymentMethod, referenceNumber: settleF.referenceNumber || undefined });
      toast(`${data.receiptNo} marked as paid`);
      setSettle(null);
      reload();
      setReceipt({ ...settle, ...data, member: settle.member, recordedBy: undefined });
    });
  };
  const addOther = (e) => {
    e.preventDefault();
    act(async () => {
      const { data } = await api.post('/payments', { ...o, amount: Number(o.amount), referenceNumber: o.referenceNumber || undefined });
      toast(`Recorded ${data.receiptNo}`);
      setOther(false);
      setO(emptyO);
      reload();
      setReceipt(data);
    });
  };
  const doVoid = () => act(async () => {
    await api.post(`/payments/${voiding._id}/void`, { reason: reason || undefined });
    toast(`${voiding.receiptNo} voided`);
    setVoiding(null);
    setReason('');
    reload();
  });
  const s = sum.data;
  return (
    <Stack spacing={2}>
      <Grid cols={{ xs: 1, sm: 3, lg: 5 }}>
        <StatCard label="Revenue (30 days)" value={s ? peso0(s.revenue30) : '—'} sub="all paid transactions" />
        <StatCard label="Memberships" value={s ? peso0(s.membership30) : '—'} sub="last 30 days" />
        <StatCard label="Walk-ins" value={s ? peso0(s.walkin30) : '—'} sub="last 30 days" />
        <StatCard label="Retail & other" value={s ? peso0(s.retail30 + s.other30) : '—'} sub={s ? `POS ${peso0(s.retail30)} · other ${peso0(s.other30)}` : ''} />
        <StatCard label="Unpaid" value={s ? peso0(s.unpaidTotal) : '—'} sub={s ? `${s.unpaidCount} invoices` : ''} subColor={brand.orange} />
      </Grid>
      <Section>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 1.5 }}>{TABS.map(([k, l]) => <Tab key={k} value={k} label={l} />)}</Tabs>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <TextField size="small" placeholder="Search name, receipt or reference…" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: { xs: '100%', sm: 280 } }} inputProps={{ 'aria-label': 'Search payments' }} />
            <TextField size="small" type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
            <TextField size="small" type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
            {(from || to) && <Button size="small" onClick={() => { setFrom(''); setTo(''); }}>Clear dates</Button>}
          </Stack>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOther(true)}>Record payment</Button>
        </Stack>
        <DataState {...list} onRetry={list.reload}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>Receipt</TableCell><TableCell>Name</TableCell><TableCell>Description</TableCell><TableCell>Type</TableCell><TableCell>Date</TableCell><TableCell>Method</TableCell><TableCell align="right">Amount</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {list.data?.items.map((p) => (
                  <TableRow key={p._id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{p.receiptNo}</TableCell>
                    <TableCell><b>{p.payerName}</b>{p.member?.memberCode && <Typography variant="caption" display="block" color="text.secondary">{p.member.memberCode}</Typography>}</TableCell>
                    <TableCell>{p.description}</TableCell>
                    <TableCell>{p.paymentType}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{fdate(p.paymentDate || p.createdAt)}</TableCell>
                    <TableCell>{p.paymentMethod}{p.paymentMethod === 'Online' && p.online?.channel ? ` · ${CHANNEL[p.online.channel] || p.online.channel}` : ''}{p.status === 'Unpaid' && p.online?.checkoutId && <Typography variant="caption" display="block" color="text.secondary">Started online payment</Typography>}{p.referenceNumber && <Typography variant="caption" display="block" color="text.secondary">Ref {p.referenceNumber}</Typography>}</TableCell>
                    <TableCell align="right"><b>{peso(p.amount)}</b></TableCell>
                    <TableCell><StatusChip label={p.status} /></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        {p.status === 'Unpaid' && p.online?.checkoutId && <Button size="small" onClick={() => act(async () => { const { data } = await api.post(`/online-payments/${p._id}/verify`); toast(data.status === 'Paid' ? `${data.receiptNo} confirmed as paid online` : 'Not paid yet on PayMongo', data.status === 'Paid' ? 'success' : 'info'); reload(); })}>Check online</Button>}
                        {p.status === 'Unpaid' && <Button size="small" variant="contained" onClick={() => { setSettle(p); setSettleF({ paymentMethod: p.referenceNumber ? 'GCash' : 'Cash', referenceNumber: p.referenceNumber || '' }); }}>{p.referenceNumber ? 'Verify & mark paid' : 'Mark paid'}</Button>}
                        {p.status === 'Paid' && <Button size="small" startIcon={<ReceiptIcon />} onClick={() => setReceipt(p)}>Receipt</Button>}
                        {role === 'admin' && p.status !== 'Void' && !p.posTransaction && <Button size="small" color="error" onClick={() => setVoiding(p)}>Void</Button>}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!list.data?.items.length && <Empty>No payments match.</Empty>}
          </Box>
          <Typography variant="caption" color="text.secondary">{list.data?.items.length} of {list.data?.total} shown</Typography>
        </DataState>
      </Section>

      <Dialog open={!!settle} onClose={() => setSettle(null)} maxWidth="xs" fullWidth PaperProps={{ component: 'form', onSubmit: doSettle }}>
        <DialogTitle>Record payment for {settle?.receiptNo}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>{settle?.payerName} · {settle?.description} · <b>{peso(settle?.amount)}</b></Typography>
          <Stack spacing={2}>
            <TextField select label="Payment method" value={settleF.paymentMethod} onChange={(e) => setSettleF({ ...settleF, paymentMethod: e.target.value })}>{METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}</TextField>
            <TextField label="Reference number" value={settleF.referenceNumber} onChange={(e) => setSettleF({ ...settleF, referenceNumber: e.target.value })} helperText={settle?.referenceNumber ? 'Check this GCash reference in the merchant app before confirming.' : ''} />
            {settle?.paymentType === 'Membership' && <Typography variant="caption" color="text.secondary">The membership period starts once this is marked as paid.</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={() => setSettle(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy}>Mark as paid</Button></DialogActions>
      </Dialog>

      <Dialog open={other} onClose={() => setOther(false)} maxWidth="xs" fullWidth PaperProps={{ component: 'form', onSubmit: addOther }}>
        <DialogTitle>Record other payment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <NameField label="Paid by" value={o.payerName} onChange={(e) => setO({ ...o, payerName: e.target.value })} required />
            <TextField label="For" placeholder="e.g. Locker rental (October)" value={o.description} onChange={(e) => setO({ ...o, description: e.target.value })} required />
            <TextField label="Amount (₱)" type="number" value={o.amount} onChange={(e) => setO({ ...o, amount: e.target.value })} inputProps={{ min: 1, step: 0.01 }} required />
            <TextField select label="Payment method" value={o.paymentMethod} onChange={(e) => setO({ ...o, paymentMethod: e.target.value })}>{METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}</TextField>
            <TextField label="Reference number" value={o.referenceNumber} onChange={(e) => setO({ ...o, referenceNumber: e.target.value })} />
            <Typography variant="caption" color="text.secondary">Sell memberships from the member record or the Point of Sale so the plan dates update.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={() => setOther(false)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy}>Save</Button></DialogActions>
      </Dialog>

      <Dialog open={!!voiding} onClose={() => setVoiding(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Void {voiding?.receiptNo}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>The payment stays in the records marked as void and no longer counts toward revenue.</Typography>
          <TextField fullWidth label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={() => setVoiding(null)}>Cancel</Button><Button variant="contained" color="error" onClick={doVoid} disabled={busy}>Void</Button></DialogActions>
      </Dialog>
      <ReceiptDialog payment={receipt} gym={gym} onClose={() => setReceipt(null)} />
    </Stack>
  );
}
