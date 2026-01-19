import type { Database } from "bun:sqlite";
import { SESSION_DURATION_MS } from "../config";
import { db as defaultDb } from "../db";
import { generateSessionId } from "../utils/session";

// Validation

export interface UsernameValidation {
  valid: boolean;
  error?: string;
}

export function validateUsername(username: string): UsernameValidation {
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!username || username.length < 3 || username.length > 20) {
    return {
      valid: false,
      error:
        "Username must be 3-20 characters, letters, numbers and underscores only",
    };
  }
  if (!usernameRegex.test(username)) {
    return {
      valid: false,
      error:
        "Username must be 3-20 characters, letters, numbers and underscores only",
    };
  }
  return { valid: true };
}

export interface PasswordValidation {
  valid: boolean;
  error?: string;
}

export function validatePassword(password: string): PasswordValidation {
  if (!password || password.length < 6) {
    return { valid: false, error: "Password must be at least 6 characters" };
  }
  return { valid: true };
}

// Password hashing

export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, { algorithm: "argon2id" });
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return await Bun.password.verify(password, hash);
}

// User operations

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
}

export function getUserById(
  userId: number,
  db: Database = defaultDb,
): { id: number; username: string } | null {
  return db
    .query<{ id: number; username: string }, [number]>(
      "SELECT id, username FROM users WHERE id = ?",
    )
    .get(userId);
}

export function getUserByUsername(
  username: string,
  db: Database = defaultDb,
): UserRow | null {
  return db
    .query<UserRow, [string]>(
      "SELECT id, username, password_hash FROM users WHERE username = ?",
    )
    .get(username.toLowerCase());
}

export function usernameExists(
  username: string,
  db: Database = defaultDb,
): boolean {
  const existing = db
    .query<{ id: number }, [string]>("SELECT id FROM users WHERE username = ?")
    .get(username.toLowerCase());
  return !!existing;
}

export function createUser(
  username: string,
  passwordHash: string,
  db: Database = defaultDb,
): number {
  const result = db.run(
    "INSERT INTO users (username, password_hash) VALUES (?, ?)",
    [username.toLowerCase(), passwordHash],
  );
  return Number(result.lastInsertRowid);
}

// Session operations

export function getUserIdFromSessionId(
  sessionId: string,
  db: Database = defaultDb,
): number | null {
  const session = db
    .query<{ user_id: number; expires_at: string }, [string]>(
      "SELECT user_id, expires_at FROM sessions WHERE id = ?",
    )
    .get(sessionId);

  if (!session || new Date(session.expires_at) < new Date()) {
    return null;
  }

  return session.user_id;
}

export function createSession(
  userId: number,
  db: Database = defaultDb,
): { sessionId: string; expiresAt: string } {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  db.run("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [
    sessionId,
    userId,
    expiresAt,
  ]);

  return { sessionId, expiresAt };
}

export function deleteSession(
  sessionId: string,
  db: Database = defaultDb,
): void {
  db.run("DELETE FROM sessions WHERE id = ?", [sessionId]);
}
