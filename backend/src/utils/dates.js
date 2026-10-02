export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
export const addDays = (d, n) => new Date(new Date(d).getTime() + n * DAY_MS);
export const daysBetween = (a, b) => Math.ceil((startOfDay(b) - startOfDay(a)) / DAY_MS);
export function dayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
export function startOfWeek(d = new Date()) {
  const x = startOfDay(d);
  return addDays(x, -((x.getDay() + 6) % 7));
}
export function hhmmToMinutes(t = '00:00') {
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
export function minutesToHhmm(n) {
  const m = ((n % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export function atTime(date, hhmm) {
  return new Date(startOfDay(date).getTime() + hhmmToMinutes(hhmm) * 60000);
}
