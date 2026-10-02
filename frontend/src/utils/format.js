import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export const peso = (n, d = 2) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
export const peso0 = (n) => peso(n, 0);
export const fdate = (d) => (d ? dayjs(d).format('MMM D, YYYY') : '—');
export const fdm = (d) => (d ? dayjs(d).format('MMM D') : '—');
export const fday = (d) => (d ? dayjs(d).format('ddd, MMM D') : '—');
export const ftime = (d) => (d ? dayjs(d).format('h:mm A') : '—');
export const fdt = (d) => (d ? dayjs(d).format('MMM D, YYYY h:mm A') : '—');
export const ago = (d) => (d ? dayjs(d).fromNow() : '—');
export const initials = (name = '') => name.split(' ').filter(Boolean).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const hhmm12 = (t) => (t ? dayjs(`2000-01-01T${t}`).format('h:mm A') : '');
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
export const deltaPct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
export const hourLabel = (h) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`);
export const isoDay = (d = new Date()) => dayjs(d).format('YYYY-MM-DD');
