/**
 * date-utils — time arithmetic utilities (UTC semantics, replaces date-fns, keeps zero-dependency + determinism)
 *
 * Aligns with SPEC v2.0 §10.5 timezone semantics: all time nodes evaluate uniformly in UTC,
 * guaranteeing byte-identical results cross-implementation and cross-timezone (stored/transmitted UTC,
 * business local timezone converted by the engine when as_of is injected).
 *
 * Only covers the 9 functions the expression-tree evaluator needs:
 *   - addYears / addMonths: UTC calendar arithmetic, month-end rollback (clamp to the target month's last day, handles 2/29 leap year)
 *   - addDays / addHours: UTC timestamp add/subtract (UTC day always 86400000ms, hour always 3600000ms, no DST)
 *   - getYear / getMonth / getDate / getDay: UTC component extraction (equivalent getUTC*)
 *   - endOfMonth: UTC last day of the month (Date.UTC month-end 00:00:00Z)
 *
 * @author Tang Haoran · OpenOBA AI Executive Officer
 * @since 2026-08-21 (M1 ported from an in-house implementation; then unified to UTC semantics aligned with SPEC §10.5)
 * @license BSL 1.1
 */

/** Days in a given year/month (month: 0-11) (UTC calendar) */
function daysInMonthUtc(year: number, month: number): number {
  // Day 0 of next month = last day of this month (UTC)
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Add N years (UTC calendar arithmetic, month-end rollback: 2/29 + 1 year → 2/28) */
export function addYears(date: Date, amount: number): Date {
  const d = new Date(date.getTime());
  const y = d.getUTCFullYear() + amount;
  const m = d.getUTCMonth();
  const day = Math.min(d.getUTCDate(), daysInMonthUtc(y, m));
  d.setUTCFullYear(y, m, day);
  return d;
}

/** Add N months (UTC calendar arithmetic, month-end rollback: 1/31 + 1 month → 2/28 or 2/29) */
export function addMonths(date: Date, amount: number): Date {
  const d = new Date(date.getTime());
  const totalMonths = d.getUTCFullYear() * 12 + d.getUTCMonth() + amount;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths - y * 12;
  const day = Math.min(d.getUTCDate(), daysInMonthUtc(y, m));
  d.setUTCFullYear(y, m, day);
  return d;
}

/** Add N days (UTC timestamp add/subtract, UTC day is always 86400000ms) */
export function addDays(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * 86400000);
}

/** Add N hours (UTC timestamp add/subtract, UTC hour is always 3600000ms) */
export function addHours(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * 3600000);
}

/** 4-digit year (UTC) */
export function getYear(date: Date): number {
  return date.getUTCFullYear();
}

/** Month (0-11, UTC) */
export function getMonth(date: Date): number {
  return date.getUTCMonth();
}

/** Date (1-31, UTC) */
export function getDate(date: Date): number {
  return date.getUTCDate();
}

/** Day of week (0=Sunday, 6=Saturday, UTC) */
export function getDay(date: Date): number {
  return date.getUTCDay();
}

/** Last day of the month (UTC month-end 00:00:00Z) */
export function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}
