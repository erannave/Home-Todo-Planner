import type { Database } from "bun:sqlite";
import { db as defaultDb } from "../db";
import type { TaskRow, TaskStatus, TaskWithStatus } from "../types";
import { normalizeToDay } from "../utils/date";

// Pure function for calculating task status - highly testable
export interface TaskStatusInput {
  is_recurring: number;
  last_completed_at: string | null;
  interval_days: number | null;
  due_date: string | null;
}

export interface TaskStatusResult {
  status: TaskStatus;
  nextDue: Date;
}

/**
 * Calculate the status of a task based on its properties and the current date.
 * This is a pure function that can be easily unit tested.
 *
 * @param task - The task properties needed for status calculation
 * @param today - Optional date to use as "today" (defaults to current date, normalized to midnight)
 */
export function calculateTaskStatus(
  task: TaskStatusInput,
  today: Date = normalizeToDay(new Date()),
): TaskStatusResult {
  let status: TaskStatus;
  let nextDue: Date;

  // Non-recurring task status logic
  if (!task.is_recurring) {
    if (!task.due_date) {
      status = "pending";
      nextDue = today;
    } else {
      const dueDateDay = normalizeToDay(new Date(task.due_date));
      nextDue = dueDateDay;
      if (dueDateDay >= today) {
        status = "pending";
      } else {
        status = "overdue";
      }
    }
    return { status, nextDue };
  }

  // Recurring task status logic
  if (!task.last_completed_at) {
    status = "overdue";
    nextDue = today;
  } else {
    const lastCompleted = new Date(task.last_completed_at);
    nextDue = new Date(lastCompleted);
    nextDue.setDate(nextDue.getDate() + (task.interval_days ?? 0));

    const nextDueDay = normalizeToDay(nextDue);

    if (nextDueDay > today) {
      status = "done";
    } else if (nextDueDay.getTime() === today.getTime()) {
      status = "pending";
    } else {
      status = "overdue";
    }
  }

  return { status, nextDue };
}

// Validation

export interface TaskValidation {
  valid: boolean;
  error?: string;
}

export function validateTaskData(data: {
  name?: string;
  is_recurring?: boolean;
  interval_days?: number;
}): TaskValidation {
  if (!data.name) {
    return { valid: false, error: "Name is required" };
  }
  if (data.is_recurring && !data.interval_days) {
    return { valid: false, error: "Interval is required for recurring tasks" };
  }
  return { valid: true };
}

// Database operations

export function getTasksForUser(
  userId: number,
  db: Database = defaultDb,
): TaskWithStatus[] {
  const tasks = db
    .query<TaskRow, [number]>(
      `SELECT
        t.id, t.name, t.notes, t.interval_days, t.is_recurring, t.due_date,
        t.category_id, c.name as category_name, c.color as category_color,
        t.assigned_member_id, m.name as assigned_member_name,
        t.last_completed_at, t.created_at
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN household_members m ON t.assigned_member_id = m.id
      WHERE t.user_id = ? AND (t.is_recurring = 1 OR t.last_completed_at IS NULL)
      ORDER BY t.name`,
    )
    .all(userId);

  const today = normalizeToDay(new Date());

  return tasks.map((task) => {
    const { status, nextDue } = calculateTaskStatus(task, today);
    return { ...task, status, next_due: nextDue.toISOString() };
  });
}

export function getTaskById(
  taskId: number,
  userId: number,
  db: Database = defaultDb,
): { id: number } | null {
  return db
    .query<{ id: number }, [number, number]>(
      "SELECT id FROM tasks WHERE id = ? AND user_id = ?",
    )
    .get(taskId, userId);
}

export interface CreateTaskData {
  name: string;
  notes?: string | null;
  interval_days?: number | null;
  is_recurring?: boolean;
  due_date?: string | null;
  category_id?: number | null;
  assigned_member_id?: number | null;
}

export function createTask(
  userId: number,
  data: CreateTaskData,
  db: Database = defaultDb,
): number {
  const isRecurring = data.is_recurring ?? true;
  const result = db.run(
    `INSERT INTO tasks (user_id, name, notes, interval_days, is_recurring, due_date, category_id, assigned_member_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      data.name,
      data.notes ?? null,
      isRecurring ? (data.interval_days ?? null) : null,
      isRecurring ? 1 : 0,
      isRecurring ? null : (data.due_date ?? null),
      data.category_id ?? null,
      data.assigned_member_id ?? null,
    ],
  );

  return Number(result.lastInsertRowid);
}

export function updateTask(
  taskId: number,
  userId: number,
  data: CreateTaskData,
  db: Database = defaultDb,
): void {
  const isRecurring = data.is_recurring ?? true;
  db.run(
    `UPDATE tasks
     SET name = ?, notes = ?, interval_days = ?, is_recurring = ?, due_date = ?, category_id = ?, assigned_member_id = ?
     WHERE id = ? AND user_id = ?`,
    [
      data.name,
      data.notes ?? null,
      isRecurring ? (data.interval_days ?? null) : null,
      isRecurring ? 1 : 0,
      isRecurring ? null : (data.due_date ?? null),
      data.category_id ?? null,
      data.assigned_member_id ?? null,
      taskId,
      userId,
    ],
  );
}

export function deleteTask(
  taskId: number,
  userId: number,
  db: Database = defaultDb,
): void {
  db.run("DELETE FROM tasks WHERE id = ? AND user_id = ?", [taskId, userId]);
}

export interface CompleteTaskData {
  completed_by_member_id?: number | null;
  notes?: string | null;
  completed_at?: string | null;
}

export function completeTask(
  taskId: number,
  data: CompleteTaskData,
  db: Database = defaultDb,
): void {
  const completionDate = data.completed_at
    ? new Date(data.completed_at).toISOString()
    : new Date().toISOString();

  db.run(
    `INSERT INTO task_completions (task_id, completed_by_member_id, completed_at, notes)
     VALUES (?, ?, ?, ?)`,
    [
      taskId,
      data.completed_by_member_id || null,
      completionDate,
      data.notes || null,
    ],
  );

  db.run("UPDATE tasks SET last_completed_at = ? WHERE id = ?", [
    completionDate,
    taskId,
  ]);
}
