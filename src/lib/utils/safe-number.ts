/**
 * Safe Numeric Utilities — Phase 13 UI Integrity
 *
 * Prevents NaN from ever reaching rendered React children.
 * Used across Dashboard, Decision Board, and job detail pages.
 */

/**
 * Safely converts a value to a finite number.
 * Returns `fallback` if the result would be NaN, Infinity, or -Infinity.
 *
 * @param value    The value to convert (may be null, undefined, string, etc.)
 * @param fallback The fallback to use when the value is not a finite number (default: 0)
 */
export function safeNumber(value: unknown, fallback: number = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Safely rounds a numeric value.
 * Returns `fallback` if the input is not a finite number.
 */
export function safeRound(value: unknown, fallback: number = 0): number {
  const n = safeNumber(value, NaN);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

/**
 * Safely formats a number using toFixed.
 * Returns `fallback` string if the input is not a finite number.
 */
export function safeFixed(value: unknown, digits: number = 0, fallback: string = '0'): string {
  const n = safeNumber(value, NaN);
  return Number.isFinite(n) ? n.toFixed(digits) : fallback;
}

/**
 * Safely computes a job age string from a firstSeenAt date string.
 * Returns empty string for invalid dates instead of producing NaN-based output.
 */
export function safeJobAge(firstSeenAt: string | null | undefined): string {
  if (!firstSeenAt) return '';
  const date = new Date(firstSeenAt);
  if (isNaN(date.getTime())) return '';
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days < 1) return 'Today';
  if (days === 1) return '1d ago';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
