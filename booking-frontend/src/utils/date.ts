// Date formatting utilities for consistent DD-MM-YYYY rendering across the app

export function formatIsoDateToDmy(isoDate: string): string {
  // expects yyyy-mm-dd
  if (!isoDate || typeof isoDate !== 'string') return isoDate as any;
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return isoDate;
  const [, y, mm, dd] = m;
  return `${dd}-${mm}-${y}`;
}

export function formatDateTimeDmy(input: string): string {
  // Handles 'yyyy-mm-dd HH:mm' (plain, no timezone) or ISO datetimes from the API.
  // Returns 'DD-MM-YYYY HH:mm' in the browser's local timezone.
  if (!input || typeof input !== 'string') return input as any;

  // Plain 'yyyy-mm-dd HH:mm' with no time-zone info — treat as-is (already local).
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(input)) {
    const [date, time] = input.split(' ');
    const [y, mm, dd] = date.split('-');
    return `${dd}-${mm}-${y} ${time}`;
  }

  // ISO datetime from the API. Strings without a Z or offset (e.g. TypeORM
  // sometimes omits it) would otherwise be parsed as local time by browsers,
  // giving the wrong UTC→local conversion. Appending Z forces correct UTC parse.
  const normalized =
    /Z$|[+-]\d{2}:\d{2}$/.test(input) ? input : input + 'Z';

  const d = new Date(normalized);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const y = String(d.getFullYear());
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}-${mm}-${y} ${hh}:${min}`;
  }
  return input;
}


