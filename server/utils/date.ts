// Date normalization utilities

/**
 * Normalize a Date to midnight (start of day) in local timezone
 * This strips time components for date-only comparisons
 */
export function normalizeToDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Get today's date normalized to midnight
 */
export function getToday(): Date {
  return normalizeToDay(new Date());
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Number of days in a given month. `month` is 0-indexed (0 = January).
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * The next date on or after `from` that falls on the given weekday (0 = Sunday).
 * Used for never-completed day-anchored tasks.
 */
export function nextWeekdayOnOrAfter(from: Date, weekday: number): Date {
  const offset = (weekday - from.getDay() + 7) % 7;
  return addDays(from, offset);
}

/**
 * The occurrence of `weekday` nearest to `from` (within ±3 days). Snap-to-nearest:
 * an offset of 0..3 days forward stays this week; 4..6 snaps back to last week.
 */
export function nearestWeekday(from: Date, weekday: number): Date {
  const offset = (weekday - from.getDay() + 7) % 7;
  return offset <= 3 ? addDays(from, offset) : addDays(from, offset - 7);
}

/**
 * Clamp a day-of-month to the last valid day of the given month.
 */
export function clampDayOfMonth(
  year: number,
  month: number,
  day: number,
): number {
  return Math.min(day, daysInMonth(year, month));
}

/**
 * A normalized Date at the clamped day-of-month of the given month.
 */
export function monthlyDateInMonth(
  year: number,
  month: number,
  day: number,
): Date {
  return new Date(year, month, clampDayOfMonth(year, month, day));
}

/**
 * The day-of-month occurrence nearest to `from`, considering the previous,
 * current, and next month (each clamped to its length).
 */
export function nearestMonthlyDay(from: Date, day: number): Date {
  const year = from.getFullYear();
  const month = from.getMonth();
  const candidates = [
    monthlyDateInMonth(year, month - 1, day),
    monthlyDateInMonth(year, month, day),
    monthlyDateInMonth(year, month + 1, day),
  ];

  let best = candidates[0];
  let bestDistance = Math.abs(candidates[0].getTime() - from.getTime());
  for (const candidate of candidates.slice(1)) {
    const distance = Math.abs(candidate.getTime() - from.getTime());
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Advance `months` from `date`, re-clamping `day` to the target month's length.
 */
export function addMonthsClamped(
  date: Date,
  months: number,
  day: number,
): Date {
  const year = date.getFullYear();
  const month = date.getMonth() + months;
  return monthlyDateInMonth(year, month, day);
}
