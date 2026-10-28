import { ApiError } from './http.js';

export function monthRange(value) {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  if (value) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(value));
    if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) throw new ApiError(400, 'Choose a month like 2026-10.');
    y = Number(match[1]);
    m = Number(match[2]) - 1;
  }
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const isCurrent = y === now.getFullYear() && m === now.getMonth();
  const elapsed = start > now ? 0 : isCurrent ? now.getDate() : daysInMonth;
  return { key: `${y}-${String(m + 1).padStart(2, '0')}`, start, end, daysInMonth, elapsed, isCurrent, label: start.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }) };
}
