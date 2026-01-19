import type { Database } from "bun:sqlite";
import { db as defaultDb } from "../db";
import type { CategoryRow } from "../types";

export function getCategoriesForUser(
  userId: number,
  db: Database = defaultDb,
): CategoryRow[] {
  return db
    .query<CategoryRow, [number]>(
      "SELECT id, name, color, created_at FROM categories WHERE user_id = ? ORDER BY name",
    )
    .all(userId);
}

export function createCategory(
  userId: number,
  name: string,
  color?: string,
  db: Database = defaultDb,
): number {
  const result = db.run(
    "INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)",
    [userId, name, color || "#6b7280"],
  );
  return Number(result.lastInsertRowid);
}

export function updateCategory(
  categoryId: number,
  userId: number,
  name: string,
  color?: string,
  db: Database = defaultDb,
): void {
  db.run(
    "UPDATE categories SET name = ?, color = ? WHERE id = ? AND user_id = ?",
    [name, color || "#6b7280", categoryId, userId],
  );
}

export function deleteCategory(
  categoryId: number,
  userId: number,
  db: Database = defaultDb,
): void {
  db.run("DELETE FROM categories WHERE id = ? AND user_id = ?", [
    categoryId,
    userId,
  ]);
}
