import { useEffect, useState } from 'react';
import { Alert, Autocomplete, Box, Button, ButtonBase, CircularProgress, Link, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import { QRCodeSVG } from 'qrcode.react';
import api, { errMsg, fileUrl } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../context/SocketContext';
import { Link as RouterLink } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import { usePageTitle, useBase } from '../../components/AppShell';
import { DataState, Empty, Section, StatusChip } from '../../components/ui';
import { peso, fdt } from '../../utils/format';
import { brand, DISPLAY_FONT } from '../../theme';
import { NameField } from '../../components/ContactFields';

const SWATCH = ['#2B2B2B', '#E8A400', '#B0262B', '#7A4A2A', '#2B6CB0', '#D9572B', '#4B4B4B', '#1E7A4C'];
const METHODS = ['Cash', 'GCash', 'Card', 'Other'];
const CHANNEL = { card: 'Card', gcash: 'GCash', paymaya: 'Maya', grab_pay: 'GrabPay', qrph: 'QR Ph' };
const methodText = (t) => (t.paymentMethod === 'Online' ? `PayMongo${t.online?.channel ? ` · ${CHANNEL[t.online.channel] || t.online.channel}` : ''}` : t.paymentMethod);

function OnlinePayDialog({ tx, onPaid, onClose }) {
  const toast = useToast();
  const [status, setStatus] = useState('Pending');
  const [busy, setBusy] = useState(false);
  const check = async () => {
    if (!tx) return;
    try {
      const { data } = await api.post(`/pos/transactions/${tx._id}/online-status`);
      if (data.status === 'Completed') onPaid(data);
      else setStatus(data.status);
    } catch (e) {
      setStatus('Error');
    }
  };
  useEffect(() => {
    if (!tx) return undefined;
    setStatus('Pending');
    const t = setInterval(check, 3000);
    return () => clearInterval(t);
  }, [tx?._id]);
  useSocketEvent('pos:online', (p) => { if (tx && p?.id === tx._id) check(); });
  const cancel = async () => {
    setBusy(true);
    try {
      await api.post(`/pos/transactions/${tx._id}/cancel-online`);
      toast('Online payment cancelled. The cart is still here.', 'info');
      onClose();
    } catch (e) {
      toast(errMsg(e), 'error');
      check();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={!!tx} maxWidth="xs" fullWidth>
      {tx && (
        <>
          <DialogTitle>Scan to pay · {peso(tx.totalAmount)}</DialogTitle>
          <DialogContent>
            <Stack alignItems="center" spacing={1.5}>
              <Typography variant="body2" textAlign="center">Ask the customer to scan this with their phone camera. They can pay with GCash, card, Maya and the other methods you turned on.</Typography>
              <Box sx={{ p: 1.5, bgcolor: '#fff', border: `1px solid ${brand.line}`, borderRadius: 2 }}><QRCodeSVG value={tx.online?.checkoutUrl || ''} size={230} /></Box>
              <Stack direction="row" spacing={1} alignItems="center">
                {status === 'Pending' && <CircularProgress size={16} />}
                <Typography variant="body2" fontWeight={700}>{status === 'Pending' ? 'Waiting for payment…' : status === 'Cancelled' ? 'Cancelled' : 'Checking…'}</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">{tx.transactionNo} · the sale completes and stock updates automatically once PayMongo confirms.</Typography>
              <Link href={tx.online?.checkoutUrl} target="_blank" rel="noreferrer" variant="body2">Open the payment page on this device instead</Link>
              {status === 'Error' && <Alert severity="warning">Could not reach PayMongo just now. Still trying…</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={check}>Check now</Button>
            <Button color="error" disabled={busy} onClick={cancel}>Cancel payment</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
const round2 = (n) => Math.round(n * 100) / 100;
const cashierName = (t, fallback) => (t.cashier?.firstName ? `${t.cashier.firstName} ${t.cashier.lastName || ''}`.trim() : fallback || '');

function TxReceipt({ tx, gym, cashier, onClose, title, primary }) {
  return (
    <Dialog open={!!tx} onClose={onClose} maxWidth="xs" fullWidth>
      {tx && (
        <>
          <DialogTitle>{title || 'Receipt'} · {tx.transactionNo}</DialogTitle>
          <DialogContent>
            <Typography variant="caption" color="text.secondary">{gym?.name} · {fdt(tx.transactionDate)} · Cashier {cashier} · {tx.customerName}</Typography>
            <Table size="small" sx={{ mt: 1 }}><TableBody>
              {(tx.items || []).map((i, k) => <TableRow key={k}><TableCell>{i.itemName} × {i.quantity}</TableCell><TableCell align="right">{peso(i.price * i.quantity)}</TableCell></TableRow>)}
              <TableRow><TableCell>Subtotal</TableCell><TableCell align="right">{peso(tx.subtotal)}</TableCell></TableRow>
              {tx.discount > 0 && <TableRow><TableCell>Discount ({tx.discountLabel || `${Math.round(tx.discountRate * 100)}%`})</TableCell><TableCell align="right">− {peso(tx.discount)}</TableCell></TableRow>}
              <TableRow><TableCell><b>Total</b></TableCell><TableCell align="right"><b>{peso(tx.totalAmount)}</b></TableCell></TableRow>
              <TableRow><TableCell>{methodText(tx)}{tx.paymentMethod === 'Cash' ? ' tendered' : ''}</TableCell><TableCell align="right">{peso(tx.amountTendered)}</TableCell></TableRow>
              <TableRow><TableCell sx={{ color: brand.green, fontWeight: 700 }}>Change</TableCell><TableCell align="right" sx={{ color: brand.green, fontWeight: 700 }}>{peso(tx.change)}</TableCell></TableRow>
              {tx.referenceNumber && <TableRow><TableCell>Reference</TableCell><TableCell align="right">{tx.referenceNumber}</TableCell></TableRow>}
            </TableBody></Table>
            {tx.status === 'Void' && <Box sx={{ mt: 1 }}><StatusChip label="Void" /></Box>}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button variant="contained" onClick={onClose}>{primary || 'Close'}</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

function Recent({ gym, role }) {
  const toast = useToast();
  const [days, setDays] = useState(7);
  const list = useFetch('/pos/transactions', { params: { days, limit: 100 } });
  useSocketEvent('payments:update', list.reload);
  const [view, setView] = useState(null);
  const [voiding, setVoiding] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const doVoid = async () => {
    setBusy(true);
    try {
      await api.post(`/pos/transactions/${voiding._id}/void`, { reason: reason || undefined });
      toast(`${voiding.transactionNo} voided and stock returned`);
      setVoiding(null);
      setReason('');
      list.reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="Recent transactions" action={<TextField select size="small" value={days} onChange={(e) => setDays(e.target.value)} sx={{ width: 150 }} inputProps={{ 'aria-label': 'Period' }}>{[[1, 'Today'], [7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']].map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}</TextField>}>
      <DataState {...list} onRetry={list.reload}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>No.</TableCell><TableCell>Date</TableCell><TableCell>Customer</TableCell><TableCell>Items</TableCell><TableCell>Method</TableCell><TableCell align="right">Total</TableCell><TableCell>Cashier</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {list.data?.items.map((t) => (
                <TableRow key={t._id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t.transactionNo}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{fdt(t.transactionDate)}</TableCell>
                  <TableCell>{t.customerName}</TableCell>
                  <TableCell sx={{ maxWidth: 260 }}><Typography variant="caption">{t.items.map((i) => `${i.itemName} ×${i.quantity}`).join(', ')}</Typography></TableCell>
                  <TableCell>{methodText(t)}</TableCell>
                  <TableCell align="right"><b>{peso(t.totalAmount)}</b>{t.discount > 0 && <Typography variant="caption" display="block" color="text.secondary">−{peso(t.discount)}</Typography>}</TableCell>
                  <TableCell>{cashierName(t)}</TableCell>
                  <TableCell><StatusChip label={t.status} /></TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Button size="small" onClick={() => setView(t)}>Receipt</Button>
                      {role === 'admin' && t.status === 'Completed' && !t.items.some((i) => i.itemType === 'Membership') && <Button size="small" color="error" onClick={() => setVoiding(t)}>Void</Button>}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!list.data?.items.length && <Empty>No transactions in this period.</Empty>}
        </Box>
      </DataState>
      <TxReceipt tx={view} gym={gym} cashier={view ? cashierName(view) : ''} onClose={() => setView(null)} />
      <Dialog open={!!voiding} onClose={() => setVoiding(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Void {voiding?.transactionNo}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Products go back to stock and linked payments are marked void.</Typography>
          <TextField fullWidth label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={() => setVoiding(null)}>Cancel</Button><Button variant="contained" color="error" disabled={busy} onClick={doVoid}>Void</Button></DialogActions>
      </Dialog>
    </Section>
  );
}

export default function POS() {
  usePageTitle('Point of Sale', 'Process sales transactions quickly and efficiently.');
  const base = useBase();
  const { gym, account, role } = useAuth();
  const toast = useToast();
  const products = useFetch('/pos/products', { initial: [] });
  const plans = useFetch('/plans', { initial: [] });
  useSocketEvent('inventory:update', products.reload);
  const [view, setView] = useState('sale');
  const [tab, setTab] = useState('products');
  const [cat, setCat] = useState('All Items');
  const [q, setQ] = useState('');
  const [cart, setCart] = useState([]);
  const [member, setMember] = useState(null);
  const [memberOpts, setMemberOpts] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [disc, setDisc] = useState(-1);
  const [method, setMethod] = useState('Cash');
  const [tendered, setTendered] = useState('');
  const [ref, setRef] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [onlineTx, setOnlineTx] = useState(null);
  const onlineOn = !!gym?.paymongo?.enabled;
  const discounts = gym?.settings?.discounts || [];
  const walkInFee = gym?.settings?.walkInFee || 0;

  const items = products.data || [];
  const cats = ['All Items', ...new Set(items.map((p) => p.category))];
  const shown = items.filter((p) => (cat === 'All Items' || p.category === cat) && (!q || `${p.productName} ${p.brand || ''} ${p.sku}`.toLowerCase().includes(q.toLowerCase())));
  const services = [
    { key: 'walkin', itemType: 'Walk-in Pass', name: 'Walk-in Day Pass', price: walkInFee, sub: 'Service' },
    ...(plans.data || []).filter((p) => p.status === 'Active').map((p) => ({ key: p._id, itemType: 'Membership', planId: p._id, name: `${p.planName} membership`, price: p.price, sub: `${p.duration} days${p.isStudentPlan ? ' · verified students' : ''}`, isStudentPlan: p.isStudentPlan })),
  ];

  const rate = disc >= 0 ? Math.min(Math.max(Number(discounts[disc]?.rate) || 0, 0), 0.5) : 0;
  const subtotal = round2(cart.reduce((a, i) => a + i.price * i.qty, 0));
  const discount = round2(subtotal * rate);
  const total = round2(subtotal - discount);
  const change = round2((parseFloat(tendered) || 0) - total);
  const hasMembership = cart.some((i) => i.itemType === 'Membership');
  const needMember = hasMembership && !member;
  const studentBlocked = cart.some((i) => i.isStudentPlan) && member && member.student?.status !== 'verified';

  const add = (item) => {
    setCart((c) => {
      const ex = c.find((i) => i.key === item.key);
      if (item.itemType === 'Membership' && (ex || c.some((i) => i.itemType === 'Membership'))) {
        toast('One membership per transaction', 'error');
        return c;
      }
      if (ex) {
        if (item.itemType === 'Product' && ex.qty >= item.stock) {
          toast(`Only ${item.stock} in stock`, 'error');
          return c;
        }
        return c.map((i) => (i.key === item.key ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...c, { ...item, qty: 1 }];
    });
  };
  const qty = (key, d) => setCart((c) => c.flatMap((i) => {
    if (i.key !== key) return [i];
    const n = i.qty + d;
    if (n <= 0) return [];
    if (i.itemType === 'Product' && n > i.stock) {
      toast(`Only ${i.stock} in stock`, 'error');
      return [i];
    }
    if (i.itemType === 'Membership' && n > 1) return [i];
    return [{ ...i, qty: n }];
  }));
  const clear = () => {
    setCart([]);
    setTendered('');
    setRef('');
    setDisc(-1);
    setMember(null);
    setCustomerName('');
  };
  const findMembers = async (text) => {
    if (text.length < 2) return setMemberOpts([]);
    try {
      const { data } = await api.get('/members', { params: { q: text, limit: 10 } });
      setMemberOpts(data.items);
    } catch {
      setMemberOpts([]);
    }
  };

  const complete = async () => {
    setBusy(true);
    try {
      const d = disc >= 0 ? discounts[disc] : null;
      const { data } = await api.post('/pos/transactions', {
        items: cart.map((i) => ({ itemType: i.itemType, productId: i.productId, planId: i.planId, quantity: i.qty })),
        memberId: member?._id,
        customerName: member ? undefined : customerName || undefined,
        discountRate: rate,
        discountLabel: d?.label,
        paymentMethod: method,
        amountTendered: method === 'Cash' ? Number(tendered) : undefined,
        referenceNumber: ref || undefined,
      });
      if (data.status === 'Pending') {
        setOnlineTx(data);
        return;
      }
      setReceipt(data);
      clear();
      products.reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const me = account ? `${account.firstName} ${account.lastName}` : '';

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap spacing={1}>
        <Tabs value={view} onChange={(_, v) => setView(v)}><Tab value="sale" label="New sale" /><Tab value="history" label="Transactions" /></Tabs>
        <Button variant="outlined" startIcon={<AddIcon />} component={RouterLink} to={`${base}/inventory?new=1`}>Add product</Button>
      </Stack>
      {view === 'history' ? <Recent gym={gym} role={role} /> : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 340px', xl: '180px 1fr 360px' }, alignItems: 'start' }}>
          <Card sx={{ display: { xs: 'none', xl: 'block' } }}>
            <CardContent sx={{ p: 1.5 }}>
              <Typography variant="body2" fontWeight={800} sx={{ px: 1, mb: 1 }}>Categories</Typography>
              {tab === 'products' ? cats.map((c) => (
                <ButtonBase key={c} onClick={() => setCat(c)} sx={{ width: '100%', justifyContent: 'space-between', px: 1.2, py: 1, borderRadius: 2, fontSize: 13, fontWeight: 600, bgcolor: cat === c ? brand.orangeSoft : 'transparent', color: cat === c ? brand.orange : brand.ink }}>
                  <span>{c}</span><span>{c === 'All Items' ? items.length : items.filter((p) => p.category === c).length}</span>
                </ButtonBase>
              )) : <Typography variant="body2" sx={{ px: 1 }}>Services & packages</Typography>}
            </CardContent>
          </Card>

          <Stack spacing={1.5} sx={{ minWidth: 0 }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="secondary" indicatorColor="secondary"><Tab value="products" label="Products" /><Tab value="services" label="Services & Packages" /></Tabs>
            {tab === 'products' && (
              <Stack direction="row" spacing={1}>
                <TextField size="small" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} inputProps={{ 'aria-label': 'Search products' }} />
                <TextField size="small" select value={cat} onChange={(e) => setCat(e.target.value)} sx={{ width: 170, display: { xl: 'none' } }} inputProps={{ 'aria-label': 'Category' }}>{cats.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField>
              </Stack>
            )}
            <DataState {...products} onRetry={products.reload}>
              <Box sx={{ display: 'grid', gap: 1.2, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                {tab === 'products' ? shown.map((p, i) => (
                  <Card key={p._id} sx={{ opacity: p.stockQuantity <= 0 ? 0.45 : 1 }}>
                    <ButtonBase disabled={p.stockQuantity <= 0} onClick={() => add({ key: p._id, itemType: 'Product', productId: p._id, name: p.productName, price: p.price, stock: p.stockQuantity })} sx={{ display: 'block', textAlign: 'left', width: '100%', p: 1.2 }}>
                      {p.imageUrl ? <Box component="img" src={fileUrl(p.imageUrl)} alt="" sx={{ width: '100%', height: 84, objectFit: 'contain', mb: 1 }} />
                        : <Box sx={{ height: 84, borderRadius: 2, bgcolor: SWATCH[i % SWATCH.length], color: '#fff', display: 'grid', placeItems: 'center', mb: 1, fontFamily: DISPLAY_FONT, fontSize: 22 }}>{p.productName.split(' ').map((w) => w[0]).join('').slice(0, 3)}</Box>}
                      <Typography variant="body2" fontWeight={700}>{p.productName}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">{p.brand || p.category}</Typography>
                      <Typography variant="caption" sx={{ color: p.stockQuantity <= p.reorderLevel ? brand.orange : 'text.secondary', fontWeight: p.stockQuantity <= p.reorderLevel ? 700 : 400 }}>{p.stockQuantity <= 0 ? 'Out of stock' : `Stock: ${p.stockQuantity}`}</Typography>
                      <Typography fontWeight={800}>{peso(p.price)}</Typography>
                    </ButtonBase>
                  </Card>
                )) : services.map((s) => (
                  <Card key={s.key}>
                    <ButtonBase onClick={() => add(s)} sx={{ display: 'block', textAlign: 'left', width: '100%', p: 1.5 }}>
                      <Box sx={{ height: 60, borderRadius: 2, bgcolor: s.itemType === 'Walk-in Pass' ? brand.yellow : brand.orange, mb: 1 }} />
                      <Typography variant="body2" fontWeight={700}>{s.name}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">{s.sub}</Typography>
                      <Typography fontWeight={800}>{peso(s.price)}</Typography>
                    </ButtonBase>
                  </Card>
                ))}
              </Box>
              {tab === 'products' && !shown.length && <Empty>No products found.</Empty>}
            </DataState>
          </Stack>

          <Card sx={{ position: { md: 'sticky' }, top: 12 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6">Current sale</Typography><Button size="small" color="error" onClick={clear} disabled={!cart.length && !member}>Clear</Button></Stack>
              <Autocomplete sx={{ mt: 1.5 }} options={memberOpts} value={member} filterOptions={(x) => x} getOptionLabel={(m) => `${m.memberCode} · ${m.name}`} isOptionEqualToValue={(a, b) => a._id === b._id}
                onInputChange={(_, v) => findMembers(v)} onChange={(_, v) => setMember(v)} renderInput={(p) => <TextField {...p} label="Member (optional)" size="small" />} noOptionsText="Type at least 2 letters" />
              {!member && <NameField sx={{ mt: 1 }} size="small" fullWidth label="Customer name (blank = Walk-in)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />}
              <Stack spacing={1} sx={{ maxHeight: 280, overflowY: 'auto', mt: 1.5 }}>
                {cart.map((i) => (
                  <Stack key={i.key} direction="row" spacing={1} alignItems="center">
                    <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="body2" fontWeight={700} noWrap>{i.name}</Typography><Typography variant="caption" color="text.secondary">{peso(i.price)}</Typography></Box>
                    <Stack direction="row" alignItems="center" sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                      <ButtonBase onClick={() => qty(i.key, -1)} sx={{ width: 26, height: 26, fontWeight: 800 }} aria-label="Less">−</ButtonBase>
                      <Typography variant="body2" sx={{ minWidth: 20, textAlign: 'center' }}>{i.qty}</Typography>
                      <ButtonBase onClick={() => qty(i.key, 1)} sx={{ width: 26, height: 26, fontWeight: 800 }} aria-label="More">+</ButtonBase>
                    </Stack>
                    <Typography variant="body2" fontWeight={700} sx={{ width: 80, textAlign: 'right' }}>{peso(i.price * i.qty)}</Typography>
                    <IconButton size="small" onClick={() => qty(i.key, -999)} aria-label="Remove" sx={{ color: brand.red }}><DeleteOutline fontSize="small" /></IconButton>
                  </Stack>
                ))}
                {!cart.length && <Empty>Tap a product or service to add it.</Empty>}
              </Stack>
              <Box sx={{ borderTop: 1, borderColor: 'divider', mt: 1.5, pt: 1.5 }}>
                <Stack direction="row" justifyContent="space-between"><Typography variant="body2">Subtotal</Typography><Typography variant="body2" fontWeight={700}>{peso(subtotal)}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ my: 0.5 }}>
                  <TextField select size="small" value={disc} onChange={(e) => setDisc(Number(e.target.value))} sx={{ width: 200 }} inputProps={{ 'aria-label': 'Discount' }}>
                    <MenuItem value={-1}>No discount</MenuItem>
                    {discounts.map((d, i) => <MenuItem key={`${d.label}-${i}`} value={i}>{d.label}</MenuItem>)}
                  </TextField>
                  <Typography variant="body2" fontWeight={700}>− {peso(discount)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}><Typography fontWeight={800} fontSize={18}>Total</Typography><Typography fontWeight={800} fontSize={18}>{peso(total)}</Typography></Stack>
              </Box>
              <Typography variant="body2" fontWeight={700} sx={{ mt: 1.5, mb: 1 }}>Payment method</Typography>
              <ToggleButtonGroup exclusive fullWidth size="small" value={method} onChange={(_, v) => v && setMethod(v)} color="secondary">{METHODS.map((m) => <ToggleButton key={m} value={m}>{m}</ToggleButton>)}</ToggleButtonGroup>
              {onlineOn && <ToggleButton fullWidth size="small" sx={{ mt: 0.75 }} value="Online" selected={method === 'Online'} onChange={() => setMethod('Online')} color="secondary">PayMongo · QR (GCash, card, Maya)</ToggleButton>}
              {method === 'Cash' ? (
                <>
                  <TextField sx={{ mt: 1.5 }} fullWidth size="small" label="Amount tendered" type="number" value={tendered} onChange={(e) => setTendered(e.target.value)} inputProps={{ min: 0, step: 0.01 }} />
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                    {[total, 100, 200, 500, 1000].filter((v, i, a) => v > 0 && a.indexOf(v) === i && v >= total).map((v) => <Button key={v} size="small" variant="outlined" onClick={() => setTendered(String(v))}>{v === total ? 'Exact' : peso(v, 0)}</Button>)}
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}><Typography fontWeight={800} sx={{ color: change >= 0 ? brand.green : brand.red }}>{change >= 0 ? 'Change' : 'Short by'}</Typography><Typography fontWeight={800} sx={{ color: change >= 0 ? brand.green : brand.red }}>{peso(Math.abs(change))}</Typography></Stack>
                </>
              ) : method === 'Online' ? (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>A QR code appears. The customer scans it and pays on their phone through PayMongo. The sale finishes by itself once payment is confirmed.</Typography>
              ) : <TextField sx={{ mt: 1.5 }} fullWidth size="small" label="Reference / approval number" value={ref} onChange={(e) => setRef(e.target.value)} />}
              {needMember && <Typography variant="caption" display="block" sx={{ color: brand.red, mt: 1 }}>Choose the member to sell a membership.</Typography>}
              {studentBlocked && <Typography variant="caption" display="block" sx={{ color: brand.red, mt: 1 }}>The student plan needs a verified school ID.</Typography>}
              <Button fullWidth sx={{ mt: 2 }} variant="contained" color="secondary" disabled={busy || !cart.length || needMember || studentBlocked || (method === 'Cash' && (tendered === '' || change < 0))} onClick={complete}>{method === 'Online' ? `Show payment QR · ${peso(total)}` : `Complete sale · ${peso(total)}`}</Button>
            </CardContent>
          </Card>
        </Box>
      )}
      <TxReceipt tx={receipt} gym={gym} cashier={me} title="Sale complete" primary="New sale" onClose={() => setReceipt(null)} />
      <OnlinePayDialog tx={onlineTx} onClose={() => setOnlineTx(null)} onPaid={(done) => { setOnlineTx(null); setReceipt(done); clear(); products.reload(); toast('Payment received. Sale complete.'); }} />
    </Stack>
  );
}
