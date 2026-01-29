import type { Database } from "bun:sqlite";
import { db as defaultDb } from "../db";

export interface WeeklyStatsRow {
  week_start: string;
  week_end: string;
  count: number;
}

export interface DayOfWeekStatsRow {
  day: number;
  name: string;
  count: number;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Get weekly completion stats for the last N weeks.
 * Returns data grouped by week with completion counts.
 * Weeks start on Sunday.
 */
export function getWeeklyStats(
  userId: number,
  weeks = 12,
  db: Database = defaultDb,
): WeeklyStatsRow[] {
  // Calculate the start date (N weeks ago, beginning of that week - Sunday)
  // Use UTC to avoid timezone issues
  const now = new Date();
  const dayOfWeek = now.getUTCDay();

  // Start of current week (Sunday) in UTC
  const currentWeekStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek),
  );

  // Go back (weeks - 1) weeks to get the start date
  const startDate = new Date(currentWeekStart);
  startDate.setUTCDate(startDate.getUTCDate() - (weeks - 1) * 7);

  // SQLite: Calculate Sunday-based week start
  // strftime('%w') returns 0 for Sunday, so we subtract that many days to get Sunday
  const rows = db
    .query<{ week_start: string; count: number }, [number, string]>(
      `SELECT
        date(completed_at, '-' || strftime('%w', completed_at) || ' days') as week_start,
        COUNT(*) as count
      FROM task_completions tc
      JOIN tasks t ON tc.task_id = t.id
      WHERE t.user_id = ?
        AND date(completed_at) >= date(?)
      GROUP BY week_start
      ORDER BY week_start ASC`,
    )
    .all(userId, startDate.toISOString().split("T")[0]);

  // Build a complete list of weeks (including those with 0 completions)
  const result: WeeklyStatsRow[] = [];
  const weekMap = new Map(rows.map((r) => [r.week_start, r.count]));

  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(startDate);
    weekStart.setUTCDate(weekStart.getUTCDate() + i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    result.push({
      week_start: weekStartStr,
      week_end: weekEndStr,
      count: weekMap.get(weekStartStr) || 0,
    });
  }

  return result;
}

/**
 * Get completion counts by day of the week.
 * Returns counts for each day (0=Sunday through 6=Saturday).
 */
export function getDayOfWeekStats(
  userId: number,
  db: Database = defaultDb,
): DayOfWeekStatsRow[] {
  // SQLite strftime %w returns day of week (0=Sunday, 6=Saturday)
  const rows = db
    .query<{ day: number; count: number }, [number]>(
      `SELECT
        CAST(strftime('%w', completed_at) AS INTEGER) as day,
        COUNT(*) as count
      FROM task_completions tc
      JOIN tasks t ON tc.task_id = t.id
      WHERE t.user_id = ?
      GROUP BY day
      ORDER BY day ASC`,
    )
    .all(userId);

  // Build complete list of all 7 days (including those with 0 completions)
  const dayMap = new Map(rows.map((r) => [r.day, r.count]));

  return DAY_NAMES.map((name, day) => ({
    day,
    name,
    count: dayMap.get(day) || 0,
  }));
}
