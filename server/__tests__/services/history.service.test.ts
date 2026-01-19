import { describe, expect, test } from "bun:test";
import {
  clearHistoryForUser,
  deleteHistoryEntry,
  getHistoryEntry,
  getHistoryForUser,
} from "../../services/history.service";
import {
  createTestCompletion,
  createTestMember,
  createTestTask,
  createTestUser,
} from "../fixtures";
import { createTestDb } from "../setup";

describe("getHistoryForUser", () => {
  test("returns completion history for user", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const taskId = createTestTask(db, userId, { name: "Test Task" });
    createTestCompletion(db, taskId, { notes: "Done!" });

    const history = getHistoryForUser(userId, db);

    expect(history).toHaveLength(1);
    expect(history[0].task_name).toBe("Test Task");
    expect(history[0].notes).toBe("Done!");
  });

  test("includes member name when available", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const memberId = createTestMember(db, userId, "Alice");
    const taskId = createTestTask(db, userId);
    createTestCompletion(db, taskId, { completed_by_member_id: memberId });

    const history = getHistoryForUser(userId, db);

    expect(history[0].completed_by_name).toBe("Alice");
  });

  test("returns empty array for user with no completions", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    createTestTask(db, userId); // Task but no completions

    const history = getHistoryForUser(userId, db);

    expect(history).toHaveLength(0);
  });

  test("does not return other users' history", () => {
    const db = createTestDb();
    const userId1 = createTestUser(db, "user1");
    const userId2 = createTestUser(db, "user2");
    const taskId = createTestTask(db, userId1);
    createTestCompletion(db, taskId);

    const history = getHistoryForUser(userId2, db);

    expect(history).toHaveLength(0);
  });

  test("returns most recent completions first", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const taskId = createTestTask(db, userId);

    createTestCompletion(db, taskId, {
      completed_at: "2024-01-01T00:00:00Z",
      notes: "First",
    });
    createTestCompletion(db, taskId, {
      completed_at: "2024-01-03T00:00:00Z",
      notes: "Third",
    });
    createTestCompletion(db, taskId, {
      completed_at: "2024-01-02T00:00:00Z",
      notes: "Second",
    });

    const history = getHistoryForUser(userId, db);

    expect(history[0].notes).toBe("Third");
    expect(history[1].notes).toBe("Second");
    expect(history[2].notes).toBe("First");
  });

  test("limits results to 100 entries", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const taskId = createTestTask(db, userId);

    // Create 105 completions
    for (let i = 0; i < 105; i++) {
      createTestCompletion(db, taskId);
    }

    const history = getHistoryForUser(userId, db);

    expect(history).toHaveLength(100);
  });
});

describe("getHistoryEntry", () => {
  test("returns entry for valid user", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const taskId = createTestTask(db, userId);
    const completionId = createTestCompletion(db, taskId);

    const entry = getHistoryEntry(completionId, userId, db);

    expect(entry).not.toBeNull();
    expect(entry?.id).toBe(completionId);
    expect(entry?.task_id).toBe(taskId);
  });

  test("returns null for non-existent entry", () => {
    const db = createTestDb();
    const userId = createTestUser(db);

    const entry = getHistoryEntry(999, userId, db);

    expect(entry).toBeNull();
  });

  test("returns null for other users' entries", () => {
    const db = createTestDb();
    const userId1 = createTestUser(db, "user1");
    const userId2 = createTestUser(db, "user2");
    const taskId = createTestTask(db, userId1);
    const completionId = createTestCompletion(db, taskId);

    const entry = getHistoryEntry(completionId, userId2, db);

    expect(entry).toBeNull();
  });
});

describe("deleteHistoryEntry", () => {
  test("removes entry from database", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const taskId = createTestTask(db, userId);
    const completionId = createTestCompletion(db, taskId);

    deleteHistoryEntry(completionId, taskId, db);

    const entry = db
      .query<{ id: number }, [number]>(
        "SELECT id FROM task_completions WHERE id = ?",
      )
      .get(completionId);

    expect(entry).toBeNull();
  });

  test("updates task last_completed_at to previous completion", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const taskId = createTestTask(db, userId);

    // Create two completions
    createTestCompletion(db, taskId, {
      completed_at: "2024-01-01T00:00:00Z",
    });
    const latestId = createTestCompletion(db, taskId, {
      completed_at: "2024-01-02T00:00:00Z",
    });

    // Update task's last_completed_at to latest
    db.run("UPDATE tasks SET last_completed_at = ? WHERE id = ?", [
      "2024-01-02T00:00:00Z",
      taskId,
    ]);

    // Delete latest completion
    deleteHistoryEntry(latestId, taskId, db);

    // Task should now show previous completion date
    const task = db
      .query<{ last_completed_at: string }, [number]>(
        "SELECT last_completed_at FROM tasks WHERE id = ?",
      )
      .get(taskId);

    expect(task?.last_completed_at).toBe("2024-01-01T00:00:00Z");
  });

  test("sets last_completed_at to null when deleting only completion", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const taskId = createTestTask(db, userId, {
      last_completed_at: "2024-01-01T00:00:00Z",
    });
    const completionId = createTestCompletion(db, taskId);

    deleteHistoryEntry(completionId, taskId, db);

    const task = db
      .query<{ last_completed_at: string | null }, [number]>(
        "SELECT last_completed_at FROM tasks WHERE id = ?",
      )
      .get(taskId);

    expect(task?.last_completed_at).toBeNull();
  });
});

describe("clearHistoryForUser", () => {
  test("removes all completions for user's tasks", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const taskId1 = createTestTask(db, userId);
    const taskId2 = createTestTask(db, userId);
    createTestCompletion(db, taskId1);
    createTestCompletion(db, taskId1);
    createTestCompletion(db, taskId2);

    clearHistoryForUser(userId, db);

    const count = db
      .query<{ count: number }, []>(
        "SELECT COUNT(*) as count FROM task_completions",
      )
      .get();

    expect(count?.count).toBe(0);
  });

  test("resets last_completed_at for all user's tasks", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    createTestTask(db, userId, { last_completed_at: "2024-01-01T00:00:00Z" });
    createTestTask(db, userId, { last_completed_at: "2024-01-02T00:00:00Z" });

    clearHistoryForUser(userId, db);

    const tasks = db
      .query<{ last_completed_at: string | null }, [number]>(
        "SELECT last_completed_at FROM tasks WHERE user_id = ?",
      )
      .all(userId);

    expect(tasks.every((t) => t.last_completed_at === null)).toBe(true);
  });

  test("does not affect other users' data", () => {
    const db = createTestDb();
    const userId1 = createTestUser(db, "user1");
    const userId2 = createTestUser(db, "user2");
    const taskId1 = createTestTask(db, userId1);
    const taskId2 = createTestTask(db, userId2, {
      last_completed_at: "2024-01-01T00:00:00Z",
    });
    createTestCompletion(db, taskId1);
    createTestCompletion(db, taskId2);

    clearHistoryForUser(userId1, db);

    // User2's completion should still exist
    const count = db
      .query<{ count: number }, [number]>(
        "SELECT COUNT(*) as count FROM task_completions WHERE task_id = ?",
      )
      .get(taskId2);

    expect(count?.count).toBe(1);

    // User2's task should still have last_completed_at
    const task = db
      .query<{ last_completed_at: string | null }, [number]>(
        "SELECT last_completed_at FROM tasks WHERE id = ?",
      )
      .get(taskId2);

    expect(task?.last_completed_at).toBe("2024-01-01T00:00:00Z");
  });
});
