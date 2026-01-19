// Type definitions for database queries

export interface TaskRow {
  id: number;
  name: string;
  notes: string | null;
  interval_days: number | null;
  is_recurring: number;
  due_date: string | null;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  assigned_member_id: number | null;
  assigned_member_name: string | null;
  last_completed_at: string | null;
  created_at: string;
}

export interface HistoryRow {
  id: number;
  task_id: number;
  task_name: string;
  is_recurring: number;
  completed_by_name: string | null;
  completed_at: string;
  notes: string | null;
}

export interface MemberRow {
  id: number;
  name: string;
  created_at: string;
}

export interface CategoryRow {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface SessionRow {
  id: string;
  user_id: number;
  expires_at: string;
}

export type TaskStatus = "done" | "pending" | "overdue";

export interface TaskWithStatus extends TaskRow {
  status: TaskStatus;
  next_due: string;
}
