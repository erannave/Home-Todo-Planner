import type { Database } from "bun:sqlite";

/**
 * Create a test user in the database
 */
export function createTestUser(
  db: Database,
  username = "testuser",
  passwordHash = "hashedpassword",
): number {
  const result = db.run(
    "INSERT INTO users (username, password_hash) VALUES (?, ?)",
    [username, passwordHash],
  );
  return Number(result.lastInsertRowid);
}

/**
 * Create a test session in the database
 */
export function createTestSession(
  db: Database,
  userId: number,
  sessionId = "test-session-id",
  expiresAt?: string,
): string {
  const expiry =
    expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.run("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [
    sessionId,
    userId,
    expiry,
  ]);
  return sessionId;
}

/**
 * Create a test category in the database
 */
export function createTestCategory(
  db: Database,
  userId: number,
  name = "Test Category",
  color = "#ff0000",
): number {
  const result = db.run(
    "INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)",
    [userId, name, color],
  );
  return Number(result.lastInsertRowid);
}

/**
 * Create a test household member in the database
 */
export function createTestMember(
  db: Database,
  userId: number,
  name = "Test Member",
): number {
  const result = db.run(
    "INSERT INTO household_members (user_id, name) VALUES (?, ?)",
    [userId, name],
  );
  return Number(result.lastInsertRowid);
}

/**
 * Create a test task in the database
 */
export function createTestTask(
  db: Database,
  userId: number,
  options: {
    name?: string;
    notes?: string | null;
    interval_days?: number | null;
    is_recurring?: number;
    due_date?: string | null;
    category_id?: number | null;
    assigned_member_id?: number | null;
    last_completed_at?: string | null;
  } = {},
): number {
  const {
    name = "Test Task",
    notes = null,
    interval_days = 7,
    is_recurring = 1,
    due_date = null,
    category_id = null,
    assigned_member_id = null,
    last_completed_at = null,
  } = options;

  const result = db.run(
    `INSERT INTO tasks (user_id, name, notes, interval_days, is_recurring, due_date, category_id, assigned_member_id, last_completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      name,
      notes,
      interval_days,
      is_recurring,
      due_date,
      category_id,
      assigned_member_id,
      last_completed_at,
    ],
  );
  return Number(result.lastInsertRowid);
}

/**
 * Create a test task completion in the database
 */
export function createTestCompletion(
  db: Database,
  taskId: number,
  options: {
    completed_by_member_id?: number | null;
    completed_at?: string;
    notes?: string | null;
  } = {},
): number {
  const {
    completed_by_member_id = null,
    completed_at = new Date().toISOString(),
    notes = null,
  } = options;

  const result = db.run(
    `INSERT INTO task_completions (task_id, completed_by_member_id, completed_at, notes)
     VALUES (?, ?, ?, ?)`,
    [taskId, completed_by_member_id, completed_at, notes],
  );
  return Number(result.lastInsertRowid);
}

/**
 * Helper to get a date string for N days ago
 */
export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

/**
 * Helper to get a date string for N days from now
 */
export function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/**
 * Helper to get today's date as ISO string (normalized to midnight)
 */
export function today(): string {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
}
