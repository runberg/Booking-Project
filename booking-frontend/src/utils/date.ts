// Date formatting utilities.
// All datetimes from the API are in UTC; we display them in the server's
// configured timezone (fetched once on app load via setServerTimezone).
// Booking date/time strings (yyyy-mm-dd, HH:mm) are plain local values
// with no timezone and are displayed as-is.

export function setServerTimezone(tz: string): void {
  if (!tz) return;
  try { localStorage.setItem('serverTimezone', tz); } catch {}
}

function getTimezone(): string {
  // Primary: injected synchronously by the container at startup into env.js
  const injected = (globalThis as any).__SERVER_TZ__;
  if (injected) return injected as string;
  // Fallback: saved to localStorage by the async fetch in App.tsx
  try { return localStorage.getItem('serverTimezone') || 'UTC'; }
  catch { return 'UTC'; }
}

export function formatIsoDateToDmy(isoDate: string): string {
  if (!isoDate || typeof isoDate !== 'string') return isoDate as any;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
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
  if (Number.isNaN(d.getTime())) return input;

  // Read timezone on every call so it's always current (fetched async from server).
  const timezone = getTimezone();
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
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
