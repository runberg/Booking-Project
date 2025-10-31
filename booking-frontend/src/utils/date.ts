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
  // Handles 'yyyy-mm-dd HH:mm' or ISO datetimes; returns 'DD-MM-YYYY HH:mm'
  if (!input || typeof input !== 'string') return input as any;
  // Case 1: 'yyyy-mm-dd HH:mm'
  const parts = input.split(' ');
  if (parts.length === 2 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0]) && /^\d{2}:\d{2}$/.test(parts[1])) {
    const [y, mm, dd] = parts[0].split('-');
    return `${dd}-${mm}-${y} ${parts[1]}`;
  }
  // Case 2: ISO string
  const d = new Date(input);
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


