// Date formatting utilities.
// All datetimes from the API are in UTC; we display them in the server's
// configured timezone (fetched once on app load via setServerTimezone).
// Booking date/time strings (yyyy-mm-dd, HH:mm) are plain local values
// with no timezone and are displayed as-is.

// Read from localStorage immediately so timezone is correct on first render,
// even before the async fetch to /health/config completes.
let serverTimezone: string = (() => {
  try { return localStorage.getItem('serverTimezone') || Intl.DateTimeFormat().resolvedOptions().timeZone; }
  catch { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
})();

export function setServerTimezone(tz: string): void {
  if (!tz) return;
  serverTimezone = tz;
  try { localStorage.setItem('serverTimezone', tz); } catch {}
}

export function formatIsoDateToDmy(isoDate: string): string {
  if (!isoDate || typeof isoDate !== 'string') return isoDate as any;
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return isoDate;
  const [, y, mm, dd] = m;
  return `${dd}-${mm}-${y}`;
}

export function formatDateTimeDmy(input: string): string {
  if (!input || typeof input !== 'string') return input as any;

  // Plain 'yyyy-mm-dd HH:mm' — no timezone, display as-is.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(input)) {
    const [date, time] = input.split(' ');
    const [y, mm, dd] = date.split('-');
    return `${dd}-${mm}-${y} ${time}`;
  }

  // ISO datetime from the API (UTC). Ensure Z so it's always parsed as UTC
  // even if TypeORM omits the suffix.
  const normalized =
    /Z$|[+-]\d{2}:\d{2}$/.test(input) ? input : input + 'Z';

  const d = new Date(normalized);
  if (isNaN(d.getTime())) return input;

  // Format in the server's timezone so times are consistent regardless of
  // what timezone the admin's browser is in.
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: serverTimezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const p: Record<string, string> = {};
    for (const part of parts) p[part.type] = part.value;
    return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`;
  } catch {
    // Fallback if timezone string is invalid
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const y = String(d.getUTCFullYear());
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    return `${dd}-${mm}-${y} ${hh}:${min}`;
  }
}
