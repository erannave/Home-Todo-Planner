import type { Database } from "bun:sqlite";
import { db as defaultDb } from "../db";
import type { HistoryRow } from "../types";

export function getHistoryForUser(
  userId: number,
  db: Database = defaultDb,
): HistoryRow[] {
  return db
    .query<HistoryRow, [number]>(
      `SELECT
        tc.id, tc.task_id, t.name as task_name, t.is_recurring,
        m.name as completed_by_name, tc.completed_at, tc.notes
      FROM task_completions tc
      JOIN tasks t ON tc.task_id = t.id
      LEFT JOIN household_members m ON tc.completed_by_member_id = m.id
      WHERE t.user_id = ?
      ORDER BY tc.completed_at DESC
      LIMIT 100`,
    )
    .all(userId);
}

export interface HistoryEntryInfo {
  id: number;
  task_id: number;
}

export function getHistoryEntry(
  entryId: number,
  userId: number,
  db: Database = defaultDb,
): HistoryEntryInfo | null {
  return db
    .query<HistoryEntryInfo, [number, number]>(
      `SELECT tc.id, tc.task_id FROM task_completions tc
       JOIN tasks t ON tc.task_id = t.id
       WHERE tc.id = ? AND t.user_id = ?`,
    )
    .get(entryId, userId);
}

export function deleteHistoryEntry(
  entryId: number,
  taskId: number,
  db: Database = defaultDb,
): void {
  db.run("DELETE FROM task_completions WHERE id = ?", [entryId]);

  // Update the task's last_completed_at to the previous completion, if any
  const previousCompletion = db
    .query<{ completed_at: string }, [number]>(
      `SELECT completed_at FROM task_completions
       WHERE task_id = ? ORDER BY completed_at DESC LIMIT 1`,
    )
    .get(taskId);

  db.run("UPDATE tasks SET last_completed_at = ? WHERE id = ?", [
    previousCompletion?.completed_at || null,
    taskId,
  ]);
}

export function clearHistoryForUser(
  userId: number,
  db: Database = defaultDb,
): void {
  // Delete all completions for tasks owned by this user
  db.run(
    `DELETE FROM task_completions WHERE task_id IN (
      SELECT id FROM tasks WHERE user_id = ?
    )`,
    [userId],
  );

  // Reset last_completed_at for all user's tasks
  db.run("UPDATE tasks SET last_completed_at = NULL WHERE user_id = ?", [
    userId,
  ]);
}
