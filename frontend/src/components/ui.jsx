import { Box, Card, CardContent, Chip, CircularProgress, Stack, Typography, Alert, Button, Dialog, DialogTitle, DialogContent, DialogActions, Avatar } from '@mui/material';
import { brand, DISPLAY_FONT } from '../theme';
import { initials, deltaPct } from '../utils/format';
import { fileUrl } from '../api';

const STATUS_COLORS = {
  green: ['Active', 'Paid', 'Completed', 'Checked Out', 'Read', 'Available', 'Verified', 'verified', 'Resolved', 'Closed', 'Operational', 'In Stock', 'active', 'In gym', 'Enrolled', 'completed'],
  amber: ['Near Expiry', 'Pending', 'pending', 'Open', 'Checked In', 'Unread', 'Low', 'In Session', 'Grace Period', 'Low Stock', 'Needs Maintenance', 'Normal'],
  purple: ['In Progress', 'Upcoming', 'Under Repair'],
  red: ['Expired', 'Unpaid', 'Void', 'Cancelled', 'Dropped', 'Auto Checked Out', 'Rejected', 'rejected', 'Out of Stock', 'Out of Order', 'void', 'High', 'suspended', 'Inactive', 'inactive'],
  blue: ['Member', 'member', 'Mobile App', 'QR Kiosk', 'Info', 'Scheduled'],
};
const PALETTE = {
  green: [brand.greenSoft, brand.green],
  amber: [brand.yellowSoft, brand.yellowInk],
  purple: [brand.purpleSoft, brand.purple],
  red: [brand.redSoft, brand.red],
  blue: [brand.blueSoft, brand.blue],
  grey: [brand.fill, brand.ink2],
};

export function StatusChip({ label, color, sx }) {
  const key = color || Object.keys(STATUS_COLORS).find((k) => STATUS_COLORS[k].includes(label)) || 'grey';
  const [bg, fg] = PALETTE[key];
  return <Chip size="small" label={label} sx={{ bgcolor: bg, color: fg, ...sx }} />;
}

export function StatCard({ label, value, sub, delta, deltaLabel = 'vs yesterday', subColor }) {
  const d = delta ? deltaPct(delta[0], delta[1]) : null;
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="body2" fontWeight={600}>{label}</Typography>
        <Typography sx={{ fontSize: 24, fontWeight: 800, my: 0.5, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
        {d !== null && delta ? (
          <Typography variant="caption" color="text.secondary">
            <Box component="span" sx={{ color: d >= 0 ? brand.green : brand.orange, fontWeight: 700 }}>{d >= 0 ? '+' : ''}{d}%</Box> {deltaLabel}
          </Typography>
        ) : (
          <Typography variant="caption" sx={{ color: subColor || 'text.secondary' }}>{sub}</Typography>
        )}
      </CardContent>
    </Card>
  );
}

export function Section({ title, action, children, sx, contentSx }) {
  return (
    <Card sx={{ height: '100%', ...sx }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, ...contentSx }}>
        {(title || action) && (
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5, gap: 1, flexWrap: 'wrap' }}>
            {title && <Typography variant="h6">{title}</Typography>}
            {action}
          </Stack>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

export function Headline({ line1, accent, rest, size = { xs: 24, md: 32 }, sx }) {
  return (
    <Typography component="h2" sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.05, fontSize: size, ...sx }}>
      {line1}
      <br />
      <Box component="span" sx={{ color: brand.yellow }}>{accent}</Box> {rest}
    </Typography>
  );
}

export function Banner({ line1, accent, rest, sub, actions }) {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, md: 3.5 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap', '&:last-child': { pb: { xs: 2.5, md: 3.5 } } }}>
        <Box>
          <Headline line1={line1} accent={accent} rest={rest} />
          {sub && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{sub}</Typography>}
        </Box>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>{actions}</Stack>
      </CardContent>
    </Card>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ py: 8 }}>
      <CircularProgress size={28} />
      <Typography variant="body2" color="text.secondary">{label}</Typography>
    </Stack>
  );
}

export function Empty({ children = 'Nothing here yet.' }) {
  return <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>{children}</Typography>;
}

export function DataState({ loading, error, data, onRetry, children }) {
  if (error) return <Alert severity="error" action={onRetry && <Button color="inherit" size="small" onClick={onRetry}>Retry</Button>}>{error}</Alert>;
  if (loading && !data) return <Loading />;
  if (!data) return null;
  return children;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, onClose, onConfirm, busy }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent><Typography variant="body2" color="text.secondary">{message}</Typography></DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button variant="contained" color={danger ? 'error' : 'primary'} onClick={onConfirm} disabled={busy}>{confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}

export function UserAvatar({ name, src, size = 34 }) {
  return (
    <Avatar src={fileUrl(src)} sx={{ width: size, height: size, fontSize: size * 0.36, fontWeight: 800, bgcolor: brand.fill, color: brand.ink2 }}>
      {initials(name)}
    </Avatar>
  );
}

export function Progress({ value, color = brand.yellow, height = 6 }) {
  return (
    <Box sx={{ height, borderRadius: 4, bgcolor: brand.fill, overflow: 'hidden', flex: 1 }}>
      <Box sx={{ width: `${Math.min(100, Math.max(0, value))}%`, height: '100%', bgcolor: color, borderRadius: 4 }} />
    </Box>
  );
}

export function Grid({ cols = { xs: 1, md: 2 }, gap = 2, children, sx }) {
  const tpl = Object.fromEntries(Object.entries(cols).map(([bp, n]) => [bp, typeof n === 'number' ? `repeat(${n}, minmax(0, 1fr))` : n]));
  return <Box sx={{ display: 'grid', gap, gridTemplateColumns: tpl, alignItems: 'stretch', ...sx }}>{children}</Box>;
}
