import type { Database } from "bun:sqlite";
import { db as defaultDb } from "../db";
import type { MemberRow } from "../types";

export function getMembersForUser(
  userId: number,
  db: Database = defaultDb,
): MemberRow[] {
  return db
    .query<MemberRow, [number]>(
      "SELECT id, name, created_at FROM household_members WHERE user_id = ? ORDER BY name",
    )
    .all(userId);
}

export function createMember(
  userId: number,
  name: string,
  db: Database = defaultDb,
): number {
  const result = db.run(
    "INSERT INTO household_members (user_id, name) VALUES (?, ?)",
    [userId, name],
  );
  return Number(result.lastInsertRowid);
}

export function updateMember(
  memberId: number,
  userId: number,
  name: string,
  db: Database = defaultDb,
): void {
  db.run("UPDATE household_members SET name = ? WHERE id = ? AND user_id = ?", [
    name,
    memberId,
    userId,
  ]);
}

export function deleteMember(
  memberId: number,
  userId: number,
  db: Database = defaultDb,
): void {
  db.run("DELETE FROM household_members WHERE id = ? AND user_id = ?", [
    memberId,
    userId,
  ]);
}
