/**
 * Central IST (Asia/Kolkata) date and time utilities for OrderPoint Pro.
 * Guarantees consistent business day rollover, timestamps, and reporting.
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns YYYY-MM-DD formatted date string in Asia/Kolkata timezone.
 */
export function getISTDateString(dateInput?: number | string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
}

/**
 * Returns formatted 12-hour time string in Asia/Kolkata timezone (e.g. "08:30 PM").
 */
export function getISTTimeString(dateInput?: number | string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Returns a human-friendly IST date and time string (e.g. "10 Nov 2026, 08:30 PM").
 */
export function formatISTDateTime(dateInput?: number | string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    timeZone: IST_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Checks whether the given date/timestamp falls on today's business day in Asia/Kolkata.
 */
export function isTodayIST(dateInput?: number | string | Date): boolean {
  if (!dateInput) return false;
  return getISTDateString(dateInput) === getISTDateString();
}
