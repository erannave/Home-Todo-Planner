import { describe, expect, test } from "bun:test";
import {
  calculateTaskStatus,
  completeTask,
  createTask,
  deleteTask,
  getTaskById,
  getTasksForUser,
  postponeAllRecurringTasks,
  updateTask,
  validateTaskData,
} from "../../services/task.service";
import { normalizeToDay } from "../../utils/date";
import { createTestTask, createTestUser, daysAgo } from "../fixtures";
import { createTestDb } from "../setup";

describe("calculateTaskStatus", () => {
  // Use a fixed "today" for deterministic tests
  const today = new Date("2024-03-15T00:00:00");

  describe("non-recurring tasks", () => {
    test("without due date returns pending status", () => {
      const result = calculateTaskStatus(
        {
          is_recurring: 0,
          last_completed_at: null,
          interval_days: null,
          due_date: null,
        },
        today,
      );

      expect(result.status).toBe("pending");
      expect(result.nextDue.getTime()).toBe(today.getTime());
    });

    test("due today returns pending status", () => {
      const result = calculateTaskStatus(
        {
          is_recurring: 0,
          last_completed_at: null,
          interval_days: null,
          due_date: "2024-03-15T00:00:00",
        },
        today,
      );

      expect(result.status).toBe("pending");
    });

    test("due in future returns pending status", () => {
      const result = calculateTaskStatus(
        {
          is_recurring: 0,
          last_completed_at: null,
          interval_days: null,
          due_date: "2024-03-20T00:00:00",
        },
        today,
      );

      expect(result.status).toBe("pending");
    });

    test("due yesterday returns overdue status", () => {
      const result = calculateTaskStatus(
        {
          is_recurring: 0,
          last_completed_at: null,
          interval_days: null,
          due_date: "2024-03-14T00:00:00",
        },
        today,
      );

      expect(result.status).toBe("overdue");
    });
  });

  describe("recurring tasks", () => {
    test("never completed returns overdue status", () => {
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: null,
          interval_days: 7,
          due_date: null,
        },
        today,
      );

      expect(result.status).toBe("overdue");
      expect(result.nextDue.getTime()).toBe(today.getTime());
    });

    test("completed within interval returns done status", () => {
      // Completed yesterday, interval is 7 days, so not due yet
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: "2024-03-14T00:00:00",
          interval_days: 7,
          due_date: null,
        },
        today,
      );

      expect(result.status).toBe("done");
    });

    test("due today (at interval boundary) returns pending status", () => {
      // Completed 7 days ago, interval is 7 days, so due today
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: "2024-03-08T00:00:00",
          interval_days: 7,
          due_date: null,
        },
        today,
      );

      expect(result.status).toBe("pending");
    });

    test("past due (beyond interval) returns overdue status", () => {
      // Completed 14 days ago, interval is 7 days, so overdue
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: "2024-03-01T00:00:00",
          interval_days: 7,
          due_date: null,
        },
        today,
      );

      expect(result.status).toBe("overdue");
    });

    test("handles different interval lengths", () => {
      // Completed 3 days ago, interval is 3 days, so due today
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: "2024-03-12T00:00:00",
          interval_days: 3,
          due_date: null,
        },
        today,
      );

      expect(result.status).toBe("pending");
    });

    test("postpone_days shifts an overdue completed task back to done", () => {
      // Completed 14 days ago, interval 7 → normally overdue. Postpone +10 pushes
      // next due to completed + 17 days = 2024-03-18, which is after today.
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: "2024-03-01T00:00:00",
          interval_days: 7,
          due_date: null,
          postpone_days: 10,
        },
        today,
      );

      expect(result.status).toBe("done");
      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-03-18T00:00:00").getTime(),
      );
    });

    test("postpone_days shifts a never-completed task to done until the shifted date", () => {
      // Never completed → normally overdue today. Postpone +5 pushes next due to
      // today + 5 = 2024-03-20, which is in the future.
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: null,
          interval_days: 7,
          due_date: null,
          postpone_days: 5,
        },
        today,
      );

      expect(result.status).toBe("done");
      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-03-20T00:00:00").getTime(),
      );
    });

    test("never-completed task is still overdue when postpone has elapsed", () => {
      // postpone_days 0 → behaves as before: overdue, due today.
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: null,
          interval_days: 7,
          due_date: null,
          postpone_days: 0,
        },
        today,
      );

      expect(result.status).toBe("overdue");
      expect(result.nextDue.getTime()).toBe(today.getTime());
    });
  });
});

describe("validateTaskData", () => {
  test("valid recurring task passes", () => {
    const result = validateTaskData({
      name: "Test Task",
      is_recurring: true,
      interval_days: 7,
    });

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test("valid non-recurring task passes", () => {
    const result = validateTaskData({
      name: "Test Task",
      is_recurring: false,
    });

    expect(result.valid).toBe(true);
  });

  test("missing name fails", () => {
    const result = validateTaskData({
      is_recurring: false,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Name is required");
  });

  test("empty name fails", () => {
    const result = validateTaskData({
      name: "",
      is_recurring: false,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Name is required");
  });

  test("recurring task without interval fails", () => {
    const result = validateTaskData({
      name: "Test Task",
      is_recurring: true,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Interval is required for recurring tasks");
  });
});

describe("task CRUD operations", () => {
  test("createTask inserts task into database", () => {
    const db = createTestDb();
    const userId = createTestUser(db);

    const taskId = createTask(
      userId,
      {
        name: "Test Task",
        notes: "Some notes",
        interval_days: 7,
        is_recurring: true,
      },
      db,
    );

    expect(taskId).toBeGreaterThan(0);

    const task = db
      .query<{ name: string; notes: string }, [number]>(
        "SELECT name, notes FROM tasks WHERE id = ?",
      )
      .get(taskId);

    expect(task?.name).toBe("Test Task");
    expect(task?.notes).toBe("Some notes");
  });

  test("getTaskById returns task for correct user", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const taskId = createTestTask(db, userId);

    const task = getTaskById(taskId, userId, db);
    expect(task).not.toBeNull();
    expect(task?.id).toBe(taskId);
  });

  test("getTaskById returns null for wrong user", () => {
    const db = createTestDb();
    const userId1 = createTestUser(db, "user1");
    const userId2 = createTestUser(db, "user2");
    const taskId = createTestTask(db, userId1);

    const task = getTaskById(taskId, userId2, db);
    expect(task).toBeNull();
  });

  test("updateTask modifies existing task", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const taskId = createTestTask(db, userId, { name: "Original Name" });

    updateTask(
      taskId,
      userId,
      {
        name: "Updated Name",
        notes: "Updated notes",
        interval_days: 14,
        is_recurring: true,
      },
      db,
    );

    const task = db
      .query<{ name: string; notes: string; interval_days: number }, [number]>(
        "SELECT name, notes, interval_days FROM tasks WHERE id = ?",
      )
      .get(taskId);

    expect(task?.name).toBe("Updated Name");
    expect(task?.notes).toBe("Updated notes");
    expect(task?.interval_days).toBe(14);
  });

  test("deleteTask removes task from database", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const taskId = createTestTask(db, userId);

    deleteTask(taskId, userId, db);

    const task = db
      .query<{ id: number }, [number]>("SELECT id FROM tasks WHERE id = ?")
      .get(taskId);

    expect(task).toBeNull();
  });

  test("deleteTask does not affect other users' tasks", () => {
    const db = createTestDb();
    const userId1 = createTestUser(db, "user1");
    const userId2 = createTestUser(db, "user2");
    const taskId = createTestTask(db, userId1);

    // Try to delete task as wrong user
    deleteTask(taskId, userId2, db);

    // Task should still exist
    const task = db
      .query<{ id: number }, [number]>("SELECT id FROM tasks WHERE id = ?")
      .get(taskId);

    expect(task).not.toBeNull();
  });
});

describe("getTasksForUser", () => {
  test("returns tasks with calculated status", () => {
    const db = createTestDb();
    const userId = createTestUser(db);

    // Create a task completed yesterday
    createTestTask(db, userId, {
      name: "Completed Task",
      is_recurring: 1,
      interval_days: 7,
      last_completed_at: daysAgo(1),
    });

    const tasks = getTasksForUser(userId, db);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe("Completed Task");
    expect(tasks[0].status).toBe("done");
    expect(tasks[0].next_due).toBeDefined();
  });

  test("filters out completed non-recurring tasks", () => {
    const db = createTestDb();
    const userId = createTestUser(db);

    // Create a completed non-recurring task (should be filtered out)
    createTestTask(db, userId, {
      name: "Completed One-time Task",
      is_recurring: 0,
      last_completed_at: daysAgo(1),
    });

    // Create an incomplete non-recurring task (should be included)
    createTestTask(db, userId, {
      name: "Pending One-time Task",
      is_recurring: 0,
      last_completed_at: null,
    });

    const tasks = getTasksForUser(userId, db);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe("Pending One-time Task");
  });
});

describe("completeTask", () => {
  test("creates completion record", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const taskId = createTestTask(db, userId);

    completeTask(taskId, { notes: "Done!" }, db);

    const completion = db
      .query<{ notes: string }, [number]>(
        "SELECT notes FROM task_completions WHERE task_id = ?",
      )
      .get(taskId);

    expect(completion?.notes).toBe("Done!");
  });

  test("updates task last_completed_at", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const taskId = createTestTask(db, userId);

    completeTask(taskId, {}, db);

    const task = db
      .query<{ last_completed_at: string }, [number]>(
        "SELECT last_completed_at FROM tasks WHERE id = ?",
      )
      .get(taskId);

    expect(task?.last_completed_at).not.toBeNull();
  });

  test("uses provided completion date", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const taskId = createTestTask(db, userId);

    const customDate = "2024-01-15T10:30:00.000Z";
    completeTask(taskId, { completed_at: customDate }, db);

    const task = db
      .query<{ last_completed_at: string }, [number]>(
        "SELECT last_completed_at FROM tasks WHERE id = ?",
      )
      .get(taskId);

    expect(task?.last_completed_at).toBe(customDate);
  });

  test("resets postpone_days to 0 on completion", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const taskId = createTestTask(db, userId, { postpone_days: 10 });

    completeTask(taskId, {}, db);

    const task = db
      .query<{ postpone_days: number }, [number]>(
        "SELECT postpone_days FROM tasks WHERE id = ?",
      )
      .get(taskId);

    expect(task?.postpone_days).toBe(0);
  });
});

describe("postponeAllRecurringTasks", () => {
  test("increments postpone_days only for recurring tasks of that user", () => {
    const db = createTestDb();
    const userId = createTestUser(db, "owner");
    const otherUserId = createTestUser(db, "other");

    const recurringId = createTestTask(db, userId, {
      name: "Recurring",
      is_recurring: 1,
    });
    const nonRecurringId = createTestTask(db, userId, {
      name: "One-time",
      is_recurring: 0,
    });
    const otherUserTaskId = createTestTask(db, otherUserId, {
      name: "Other user recurring",
      is_recurring: 1,
    });

    const count = postponeAllRecurringTasks(userId, 7, db);

    expect(count).toBe(1);

    const getPostpone = (id: number) =>
      db
        .query<{ postpone_days: number }, [number]>(
          "SELECT postpone_days FROM tasks WHERE id = ?",
        )
        .get(id)?.postpone_days;

    expect(getPostpone(recurringId)).toBe(7);
    expect(getPostpone(nonRecurringId)).toBe(0);
    expect(getPostpone(otherUserTaskId)).toBe(0);
  });

  test("is cumulative across calls", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const taskId = createTestTask(db, userId, { is_recurring: 1 });

    postponeAllRecurringTasks(userId, 7, db);
    postponeAllRecurringTasks(userId, 3, db);

    const task = db
      .query<{ postpone_days: number }, [number]>(
        "SELECT postpone_days FROM tasks WHERE id = ?",
      )
      .get(taskId);

    expect(task?.postpone_days).toBe(10);
  });
});
