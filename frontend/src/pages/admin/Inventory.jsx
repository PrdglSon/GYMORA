import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import api, { errMsg, fileUrl } from '../../api';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../context/SocketContext';
import { usePageTitle } from '../../components/AppShell';
import { DataState, Grid, Section, StatCard, StatusChip, Empty } from '../../components/ui';
import { peso, peso0, fdt } from '../../utils/format';
import { brand } from '../../theme';

const CATS = ['Supplements', 'Pre-Workout', 'Vitamins', 'Snacks', 'Drinks', 'Apparel', 'Accessories'];
const stockLabel = (p) => (p.stockQuantity <= 0 ? 'Out of Stock' : p.stockQuantity <= p.reorderLevel ? 'Low Stock' : 'In Stock');

function StockHistory({ product, onClose }) {
  const d = useFetch(product ? `/pos/products/${product._id}/inventory` : null, { initial: [] });
  useSocketEvent('inventory:update', (x) => product && String(x?.id) === String(product._id) && d.reload());
  return (
    <Dialog open={!!product} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Stock history · {product?.productName}</DialogTitle>
      <DialogContent>
        <DataState {...d} onRetry={d.reload}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>When</TableCell><TableCell>Type</TableCell><TableCell align="right">Quantity</TableCell><TableCell align="right">Stock after</TableCell><TableCell>By</TableCell><TableCell>Note</TableCell></TableRow></TableHead>
              <TableBody>
                {d.data?.map((m) => (
                  <TableRow key={m._id}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{fdt(m.lastUpdated || m.createdAt)}</TableCell>
                    <TableCell><StatusChip label={m.status} color={m.status === 'Sale' ? 'blue' : m.status === 'Void' ? 'red' : m.status === 'Adjustment' ? 'purple' : 'green'} /></TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: m.quantity > 0 ? brand.green : brand.red }}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</TableCell>
                    <TableCell align="right">{m.stockAfter ?? '—'}</TableCell>
                    <TableCell>{m.updatedBy ? `${m.updatedBy.firstName} ${m.updatedBy.lastName || ''}` : '—'}</TableCell>
                    <TableCell>{m.note || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!d.data?.length && <Empty>No stock movements yet.</Empty>}
          </Box>
        </DataState>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}

export default function Inventory() {
  usePageTitle('Inventory', "Manage your gym's inventory and stock levels.");
  const { role } = useAuth();
  const admin = role === 'admin';
  const toast = useToast();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const params = { status: 'all', q: q || undefined, ...(filter === 'low' || filter === 'out' ? { stock: filter } : filter ? { category: filter } : {}) };
  const p = useFetch('/pos/products', { params, initial: [] });
  const all = useFetch('/pos/products', { params: { status: 'all' }, initial: [] });
  const reload = () => {
    p.reload();
    all.reload();
  };
  useSocketEvent('inventory:update', reload);
  const [restock, setRestock] = useState(null);
  const [rs, setRs] = useState({ quantity: 10, note: '' });
  const [adjust, setAdjust] = useState(null);
  const [adj, setAdj] = useState({ quantity: '', note: '' });
  const [edit, setEdit] = useState(undefined);
  const [f, setF] = useState(null);
  const [img, setImg] = useState(null);
  const [history, setHistory] = useState(null);
  const [busy, setBusy] = useState(false);

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
  const doRestock = (e) => {
    e.preventDefault();
    act(async () => {
      const { data } = await api.post(`/pos/products/${restock._id}/restock`, { quantity: Number(rs.quantity), note: rs.note || undefined });
      toast(`${data.productName}: ${data.stockQuantity} in stock`);
      setRestock(null);
      reload();
    });
  };
  const doAdjust = (e) => {
    e.preventDefault();
    act(async () => {
      const { data } = await api.post(`/pos/products/${adjust._id}/adjust`, { quantity: Number(adj.quantity), note: adj.note });
      toast(`${data.productName}: ${data.stockQuantity} in stock`);
      setAdjust(null);
      reload();
    });
  };
  const [search, setSearch] = useSearchParams();
  useEffect(() => {
    if (search.get('new') === '1') {
      openEdit(null);
      setSearch({}, { replace: true });
    }
  }, []);
  const openEdit = (x) => {
    setImg(null);
    setF(x ? { productName: x.productName, brand: x.brand || '', category: x.category, price: x.price, cost: x.cost ?? '', reorderLevel: x.reorderLevel, status: x.status, stockQuantity: x.stockQuantity, sku: x.sku } : { productName: '', brand: '', category: 'Supplements', price: '', cost: '', reorderLevel: 5, status: 'Active', stockQuantity: 0, sku: '' });
    setEdit(x || null);
  };
  const save = (e) => {
    e.preventDefault();
    act(async () => {
      const fd = new FormData();
      const keys = ['productName', 'brand', 'category', 'price', 'cost', 'reorderLevel', 'status', ...(edit ? [] : ['stockQuantity', 'sku'])];
      keys.forEach((k) => {
        if (f[k] !== '' && f[k] !== undefined && f[k] !== null) fd.append(k, f[k]);
      });
      if (img) fd.append('image', img);
      if (edit) await api.patch(`/pos/products/${edit._id}`, fd);
      else await api.post('/pos/products', fd);
      toast('Product saved');
      setEdit(undefined);
      reload();
    });
  };

  const a = all.data || [];
  const activeItems = a.filter((x) => x.status === 'Active');
  const cats = [...new Set([...CATS, ...a.map((x) => x.category)])];
  return (
    <Stack spacing={2}>
      <Grid cols={{ xs: 1, sm: 3, lg: 5 }}>
        <StatCard label="Products" value={a.length} sub={`${a.length - activeItems.length} inactive`} />
        <StatCard label="Units in stock" value={activeItems.reduce((s, x) => s + Math.max(0, x.stockQuantity), 0)} sub="active products" />
        <StatCard label="Stock value" value={peso0(activeItems.reduce((s, x) => s + Math.max(0, x.stockQuantity) * x.price, 0))} sub="at selling price" />
        <StatCard label="Low stock" value={activeItems.filter((x) => x.stockQuantity > 0 && x.stockQuantity <= x.reorderLevel).length} sub="at or below reorder level" subColor={brand.yellowInk} />
        <StatCard label="Out of stock" value={activeItems.filter((x) => x.stockQuantity <= 0).length} sub="needs restock" subColor={brand.red} />
      </Grid>
      <Section>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <TextField size="small" placeholder="Search product, brand or SKU…" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: 260 }} inputProps={{ 'aria-label': 'Search products' }} />
            <TextField size="small" select value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ width: 180 }} SelectProps={{ displayEmpty: true }} inputProps={{ 'aria-label': 'Filter' }}>
              <MenuItem value="">All products</MenuItem><MenuItem value="low">Low stock</MenuItem><MenuItem value="out">Out of stock</MenuItem>{cats.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
            {!admin && <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 260 }}>Staff can add and restock products. Only administrators can edit products, adjust stock or void sales.</Typography>}
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => openEdit(null)}>Add product</Button>
          </Stack>
        </Stack>
        <DataState {...p} onRetry={p.reload}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>SKU</TableCell><TableCell>Product</TableCell><TableCell>Category</TableCell><TableCell align="right">Price</TableCell><TableCell align="right">Stock</TableCell><TableCell align="right">Reorder at</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {p.data?.map((x) => {
                  const low = x.status === 'Active' && x.stockQuantity <= x.reorderLevel;
                  return (
                    <TableRow key={x._id} sx={{ opacity: x.status === 'Active' ? 1 : 0.5, bgcolor: low ? (x.stockQuantity <= 0 ? brand.redSoft : brand.yellowSoft) : undefined }}>
                      <TableCell>{x.sku}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {x.imageUrl && <Box component="img" src={fileUrl(x.imageUrl)} alt="" sx={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 1 }} />}
                          <Box><b>{x.productName}</b><Typography variant="caption" display="block" color="text.secondary">{x.brand}</Typography></Box>
                        </Stack>
                      </TableCell>
                      <TableCell>{x.category}</TableCell>
                      <TableCell align="right">{peso(x.price)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, color: low ? brand.red : undefined }}>{x.stockQuantity}</TableCell>
                      <TableCell align="right">{x.reorderLevel}</TableCell>
                      <TableCell><StatusChip label={x.status === 'Active' ? stockLabel(x) : 'Inactive'} /></TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="contained" onClick={() => { setRestock(x); setRs({ quantity: 10, note: '' }); }}>Restock</Button>
                          <Button size="small" variant="outlined" onClick={() => setHistory(x)}>Stock history</Button>
                          {admin && <Button size="small" variant="outlined" onClick={() => { setAdjust(x); setAdj({ quantity: '', note: '' }); }}>Adjust</Button>}
                          {admin && <Button size="small" variant="outlined" onClick={() => openEdit(x)}>Edit</Button>}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {!p.data?.length && <Empty>No products match.</Empty>}
          </Box>
        </DataState>
      </Section>

      <Dialog open={!!restock} onClose={() => setRestock(null)} maxWidth="xs" fullWidth PaperProps={{ component: 'form', onSubmit: doRestock }}>
        <DialogTitle>Restock {restock?.productName}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Current stock: {restock?.stockQuantity}</Typography>
          <Stack spacing={2}>
            <TextField label="Quantity received" type="number" value={rs.quantity} onChange={(e) => setRs({ ...rs, quantity: e.target.value })} inputProps={{ min: 1 }} required />
            <TextField label="Supplier / note" value={rs.note} onChange={(e) => setRs({ ...rs, note: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={() => setRestock(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy}>Add stock</Button></DialogActions>
      </Dialog>

      <Dialog open={!!adjust} onClose={() => setAdjust(null)} maxWidth="xs" fullWidth PaperProps={{ component: 'form', onSubmit: doAdjust }}>
        <DialogTitle>Adjust {adjust?.productName}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Current stock: {adjust?.stockQuantity}. Use a negative number for damaged, expired or missing items.</Typography>
          <Stack spacing={2}>
            <TextField label="Change (e.g. -2 or 3)" type="number" value={adj.quantity} onChange={(e) => setAdj({ ...adj, quantity: e.target.value })} required />
            <TextField label="Reason" value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} required />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={() => setAdjust(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy || !Number(adj.quantity)}>Save adjustment</Button></DialogActions>
      </Dialog>

      <Dialog open={edit !== undefined} onClose={() => setEdit(undefined)} maxWidth="sm" fullWidth PaperProps={{ component: 'form', onSubmit: save }}>
        <DialogTitle>{edit ? 'Edit product' : 'Add product'}</DialogTitle>
        <DialogContent>
          {f && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Grid cols={{ xs: 1, sm: 2 }}>
                <TextField label="Product name" value={f.productName} onChange={(e) => setF({ ...f, productName: e.target.value })} required />
                <TextField label="Brand" value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} />
                <TextField select label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{cats.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField>
                <TextField label="Selling price (₱)" type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} inputProps={{ min: 0, step: 0.01 }} required />
                <TextField label="Cost (₱, optional)" type="number" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} inputProps={{ min: 0, step: 0.01 }} />
                <TextField label="Reorder level" type="number" value={f.reorderLevel} onChange={(e) => setF({ ...f, reorderLevel: e.target.value })} inputProps={{ min: 0 }} />
                {!edit && <TextField label="Starting stock" type="number" value={f.stockQuantity} onChange={(e) => setF({ ...f, stockQuantity: e.target.value })} inputProps={{ min: 0 }} />}
                {!edit && <TextField label="SKU (optional)" value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} helperText="Leave blank to generate" />}
                {edit && <TextField select label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{['Active', 'Inactive'].map((s) => <MenuItem key={s} value={s}>{s === 'Active' ? 'Active (shown in POS)' : 'Inactive'}</MenuItem>)}</TextField>}
              </Grid>
              <Button component="label" variant="outlined" sx={{ alignSelf: 'flex-start' }}>{img ? img.name : 'Upload photo (optional)'}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setImg(e.target.files[0] || null)} /></Button>
              {edit && <Typography variant="caption" color="text.secondary">Stock changes go through Restock or Adjust so they appear in the stock history.</Typography>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={() => setEdit(undefined)}>Cancel</Button><Button type="submit" variant="contained" disabled={busy}>Save product</Button></DialogActions>
      </Dialog>
      <StockHistory product={history} onClose={() => setHistory(null)} />
    </Stack>
  );
}
