import { describe, expect, test } from "bun:test";
import {
  createCategory,
  deleteCategory,
  getCategoriesForUser,
  updateCategory,
} from "../../services/category.service";
import { createTestCategory, createTestUser } from "../fixtures";
import { createTestDb } from "../setup";

describe("getCategoriesForUser", () => {
  test("returns categories for user", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    createTestCategory(db, userId, "Kitchen", "#ff0000");
    createTestCategory(db, userId, "Bathroom", "#00ff00");

    const categories = getCategoriesForUser(userId, db);

    expect(categories).toHaveLength(2);
    expect(categories.map((c) => c.name)).toContain("Kitchen");
    expect(categories.map((c) => c.name)).toContain("Bathroom");
  });

  test("returns empty array for user with no categories", () => {
    const db = createTestDb();
    const userId = createTestUser(db);

    const categories = getCategoriesForUser(userId, db);

    expect(categories).toHaveLength(0);
  });

  test("does not return other users' categories", () => {
    const db = createTestDb();
    const userId1 = createTestUser(db, "user1");
    const userId2 = createTestUser(db, "user2");
    createTestCategory(db, userId1, "Kitchen");

    const categories = getCategoriesForUser(userId2, db);

    expect(categories).toHaveLength(0);
  });

  test("returns categories sorted by name", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    createTestCategory(db, userId, "Yard");
    createTestCategory(db, userId, "Bathroom");
    createTestCategory(db, userId, "Kitchen");

    const categories = getCategoriesForUser(userId, db);

    expect(categories[0].name).toBe("Bathroom");
    expect(categories[1].name).toBe("Kitchen");
    expect(categories[2].name).toBe("Yard");
  });
});

describe("createCategory", () => {
  test("inserts category into database", () => {
    const db = createTestDb();
    const userId = createTestUser(db);

    const categoryId = createCategory(userId, "Kitchen", "#ff0000", db);

    expect(categoryId).toBeGreaterThan(0);

    const category = db
      .query<{ name: string; color: string }, [number]>(
        "SELECT name, color FROM categories WHERE id = ?",
      )
      .get(categoryId);

    expect(category?.name).toBe("Kitchen");
    expect(category?.color).toBe("#ff0000");
  });

  test("uses default color when not provided", () => {
    const db = createTestDb();
    const userId = createTestUser(db);

    const categoryId = createCategory(userId, "Kitchen", undefined, db);

    const category = db
      .query<{ color: string }, [number]>(
        "SELECT color FROM categories WHERE id = ?",
      )
      .get(categoryId);

    expect(category?.color).toBe("#6b7280");
  });
});

describe("updateCategory", () => {
  test("updates category name and color", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const categoryId = createTestCategory(db, userId, "Kitchen", "#ff0000");

    updateCategory(categoryId, userId, "Cooking Area", "#00ff00", db);

    const category = db
      .query<{ name: string; color: string }, [number]>(
        "SELECT name, color FROM categories WHERE id = ?",
      )
      .get(categoryId);

    expect(category?.name).toBe("Cooking Area");
    expect(category?.color).toBe("#00ff00");
  });

  test("uses default color when not provided", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const categoryId = createTestCategory(db, userId, "Kitchen", "#ff0000");

    updateCategory(categoryId, userId, "Updated", undefined, db);

    const category = db
      .query<{ color: string }, [number]>(
        "SELECT color FROM categories WHERE id = ?",
      )
      .get(categoryId);

    expect(category?.color).toBe("#6b7280");
  });

  test("does not update other users' categories", () => {
    const db = createTestDb();
    const userId1 = createTestUser(db, "user1");
    const userId2 = createTestUser(db, "user2");
    const categoryId = createTestCategory(db, userId1, "Kitchen", "#ff0000");

    updateCategory(categoryId, userId2, "Hacked", "#000000", db);

    const category = db
      .query<{ name: string; color: string }, [number]>(
        "SELECT name, color FROM categories WHERE id = ?",
      )
      .get(categoryId);

    expect(category?.name).toBe("Kitchen");
    expect(category?.color).toBe("#ff0000");
  });
});

describe("deleteCategory", () => {
  test("removes category from database", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const categoryId = createTestCategory(db, userId);

    deleteCategory(categoryId, userId, db);

    const category = db
      .query<{ id: number }, [number]>("SELECT id FROM categories WHERE id = ?")
      .get(categoryId);

    expect(category).toBeNull();
  });

  test("does not delete other users' categories", () => {
    const db = createTestDb();
    const userId1 = createTestUser(db, "user1");
    const userId2 = createTestUser(db, "user2");
    const categoryId = createTestCategory(db, userId1);

    deleteCategory(categoryId, userId2, db);

    const category = db
      .query<{ id: number }, [number]>("SELECT id FROM categories WHERE id = ?")
      .get(categoryId);

    expect(category).not.toBeNull();
  });
});
