const pad = (n: number) => String(n).padStart(2, '0');

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseISODate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayISO = () => toISODate(new Date());

export const isISODate = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toISODate(parseISODate(s)) === s;
};

export const addDays = (iso: string, n: number) => {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

export const addMonths = (iso: string, n: number) => {
  const d = parseISODate(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISODate(d);
};

/** Monday of the week containing `iso`. */
export const startOfWeek = (iso: string) => {
  const dow = (parseISODate(iso).getDay() + 6) % 7;
  return addDays(iso, -dow);
};

export const weekDays = (iso: string) => {
  const start = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

/** Six Monday-first weeks covering the month containing `iso`. */
export const monthGrid = (iso: string) => {
  const start = startOfWeek(`${iso.slice(0, 8)}01`);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
};

export const daysBetween = (fromISO: string, toISO: string) => {
  const a = parseISODate(fromISO);
  const b = parseISODate(toISO);
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc(b) - utc(a)) / 86_400_000);
};

/** 1-based week of a block that `iso` falls in, or null when outside the block. */
export const blockWeek = (startDate: string, weeks: number, iso: string) => {
  const diff = daysBetween(startDate, iso);
  if (diff < 0) return null;
  const week = Math.floor(diff / 7) + 1;
  return week <= weeks ? week : null;
};

export const formatMonth = (iso: string) =>
  parseISODate(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

export const formatLongDay = (iso: string) =>
  parseISODate(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

export const formatShortDate = (iso: string) =>
  parseISODate(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
