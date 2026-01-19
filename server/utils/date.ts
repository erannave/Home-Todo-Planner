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
