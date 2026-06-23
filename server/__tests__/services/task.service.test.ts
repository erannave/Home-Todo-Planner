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
  // Use a fixed "today" for deterministic tests (2024-03-15 is a Friday)
  const today = new Date("2024-03-15T00:00:00");

  describe("non-recurring tasks", () => {
    test("without due date returns pending status", () => {
      const result = calculateTaskStatus(
        {
          is_recurring: 0,
          last_completed_at: null,
          interval_days: null,
          due_date: null,
          recurrence_type: "interval",
          recurrence_day: null,
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
          recurrence_type: "interval",
          recurrence_day: null,
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
          recurrence_type: "interval",
          recurrence_day: null,
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
          recurrence_type: "interval",
          recurrence_day: null,
        },
        today,
      );

      expect(result.status).toBe("overdue");
    });
  });

  describe("recurring tasks (interval)", () => {
    test("never completed returns overdue status", () => {
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: null,
          interval_days: 7,
          due_date: null,
          recurrence_type: "interval",
          recurrence_day: null,
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
          recurrence_type: "interval",
          recurrence_day: null,
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
          recurrence_type: "interval",
          recurrence_day: null,
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
          recurrence_type: "interval",
          recurrence_day: null,
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
          recurrence_type: "interval",
          recurrence_day: null,
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
          recurrence_type: "interval",
          recurrence_day: null,
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
          recurrence_type: "interval",
          recurrence_day: null,
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
          recurrence_type: "interval",
          recurrence_day: null,
        },
        today,
      );

      expect(result.status).toBe("overdue");
      expect(result.nextDue.getTime()).toBe(today.getTime());
    });
  });

  describe("recurring tasks (weekly)", () => {
    // today = Fri 2024-03-15. Weekdays: 0=Sun .. 5=Fri .. 6=Sat
    test("never completed: due on the next occurrence of the weekday", () => {
      // Next Monday (day 1) on/after Fri 2024-03-15 is 2024-03-18
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: null,
          interval_days: 1,
          due_date: null,
          recurrence_type: "weekly",
          recurrence_day: 1,
        },
        today,
      );

      expect(result.status).toBe("done");
      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-03-18T00:00:00").getTime(),
      );
    });

    test("never completed: due today when today is the weekday → pending", () => {
      // Friday = day 5, today is Friday
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: null,
          interval_days: 1,
          due_date: null,
          recurrence_type: "weekly",
          recurrence_day: 5,
        },
        today,
      );

      expect(result.status).toBe("pending");
      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-03-15T00:00:00").getTime(),
      );
    });

    test("completed a day early (Sat) snaps to that week's Monday then +7", () => {
      // Weekly on Monday (day 1). Completed Sat 2024-03-16 (the day before the
      // Monday). nearestWeekday → Mon 2024-03-18; +7 → Mon 2024-03-25.
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: "2024-03-16T12:00:00",
          interval_days: 1,
          due_date: null,
          recurrence_type: "weekly",
          recurrence_day: 1,
        },
        today,
      );

      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-03-25T00:00:00").getTime(),
      );
    });

    test("completed a day late (Tue) snaps to the same Monday then +7 (skips the week)", () => {
      // Weekly on Monday. Completed Tue 2024-03-19, one day after Mon 2024-03-18.
      // nearestWeekday → Mon 2024-03-18; +7 → Mon 2024-03-25 (same as the early case).
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: "2024-03-19T12:00:00",
          interval_days: 1,
          due_date: null,
          recurrence_type: "weekly",
          recurrence_day: 1,
        },
        today,
      );

      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-03-25T00:00:00").getTime(),
      );
    });

    test("multiplier N=2: next is nearest weekday + 14", () => {
      // Every 2 weeks on Monday. Completed Mon 2024-03-18; +14 → Mon 2024-04-01.
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: "2024-03-18T00:00:00",
          interval_days: 2,
          due_date: null,
          recurrence_type: "weekly",
          recurrence_day: 1,
        },
        today,
      );

      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-04-01T00:00:00").getTime(),
      );
    });

    test("postpone advances a weekly task one whole week, staying on the weekday", () => {
      // Weekly on Monday. Completed Mon 2024-03-11 → next Mon 2024-03-18, which is
      // inside the window [03-15, 03-20). Postpone advances one full week to the
      // next Monday 2024-03-25 (NOT a raw +5 → 03-23).
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: "2024-03-11T00:00:00",
          interval_days: 1,
          due_date: null,
          postpone_days: 5,
          recurrence_type: "weekly",
          recurrence_day: 1,
        },
        today,
      );

      expect(result.status).toBe("done");
      expect(normalizeToDay(result.nextDue).getDay()).toBe(1); // still a Monday
      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-03-25T00:00:00").getTime(),
      );
    });

    test("postpone leaves a weekly task untouched when its occurrence is past the window", () => {
      // Next Mon 2024-03-18 is outside the window [03-15, 03-17). Unchanged.
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: "2024-03-11T00:00:00",
          interval_days: 1,
          due_date: null,
          postpone_days: 2,
          recurrence_type: "weekly",
          recurrence_day: 1,
        },
        today,
      );

      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-03-18T00:00:00").getTime(),
      );
    });

    test("postpone with a large window skips multiple whole weeks", () => {
      // Next Mon 2024-03-18 with a 30-day window [03-15, 04-14). Advances week by
      // week (03-25, 04-01, 04-08) until 2024-04-15 clears the window — still Monday.
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: "2024-03-11T00:00:00",
          interval_days: 1,
          due_date: null,
          postpone_days: 30,
          recurrence_type: "weekly",
          recurrence_day: 1,
        },
        today,
      );

      expect(normalizeToDay(result.nextDue).getDay()).toBe(1); // still a Monday
      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-04-15T00:00:00").getTime(),
      );
    });

    test("postpone window is exclusive: an occurrence exactly on today + X stays put", () => {
      // Next Mon 2024-03-18 with postpone 3 → window end is exactly 03-18. The
      // occurrence on the boundary is "back" and is not moved.
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: "2024-03-11T00:00:00",
          interval_days: 1,
          due_date: null,
          postpone_days: 3,
          recurrence_type: "weekly",
          recurrence_day: 1,
        },
        today,
      );

      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-03-18T00:00:00").getTime(),
      );
    });
  });

  describe("recurring tasks (monthly)", () => {
    test("never completed: due on this month's day if on/after today", () => {
      // The 20th of March is after Fri the 15th → due 2024-03-20.
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: null,
          interval_days: 1,
          due_date: null,
          recurrence_type: "monthly",
          recurrence_day: 20,
        },
        today,
      );

      expect(result.status).toBe("done");
      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-03-20T00:00:00").getTime(),
      );
    });

    test("never completed: rolls to next month when this month's day has passed", () => {
      // The 1st of March is before the 15th → due 2024-04-01.
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: null,
          interval_days: 1,
          due_date: null,
          recurrence_type: "monthly",
          recurrence_day: 1,
        },
        today,
      );

      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-04-01T00:00:00").getTime(),
      );
    });

    test("completed near day-15: next is day-15 of next month", () => {
      // Monthly on the 15th. Completed 2024-03-15 → next 2024-04-15.
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: "2024-03-15T00:00:00",
          interval_days: 1,
          due_date: null,
          recurrence_type: "monthly",
          recurrence_day: 15,
        },
        today,
      );

      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-04-15T00:00:00").getTime(),
      );
    });

    test("day-31 clamps to last day of a short month (Feb)", () => {
      // Monthly on the 31st. Completed Jan 31 2024 → next Feb, clamped to Feb 29
      // (2024 is a leap year).
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: "2024-01-31T00:00:00",
          interval_days: 1,
          due_date: null,
          recurrence_type: "monthly",
          recurrence_day: 31,
        },
        new Date("2024-02-10T00:00:00"),
      );

      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-02-29T00:00:00").getTime(),
      );
    });

    test("day-31 clamps to 30 in a 30-day month", () => {
      // Monthly on the 31st. Completed Mar 31 2024 → next Apr, clamped to Apr 30.
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: "2024-03-31T00:00:00",
          interval_days: 1,
          due_date: null,
          recurrence_type: "monthly",
          recurrence_day: 31,
        },
        new Date("2024-04-05T00:00:00"),
      );

      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-04-30T00:00:00").getTime(),
      );
    });

    test("multiplier N=3: advances three months", () => {
      // Every 3 months on the 1st. Completed 2024-03-01 → next 2024-06-01.
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: "2024-03-01T00:00:00",
          interval_days: 3,
          due_date: null,
          recurrence_type: "monthly",
          recurrence_day: 1,
        },
        today,
      );

      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-06-01T00:00:00").getTime(),
      );
    });

    test("postpone advances a monthly task one whole month, staying on the day-of-month", () => {
      // Monthly on the 20th. Completed 2024-02-20 → next 2024-03-20, inside the
      // window [03-15, 03-25). Postpone advances one full month to 2024-04-20
      // (NOT a raw +10 → 03-30).
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: "2024-02-20T00:00:00",
          interval_days: 1,
          due_date: null,
          postpone_days: 10,
          recurrence_type: "monthly",
          recurrence_day: 20,
        },
        today,
      );

      expect(result.status).toBe("done");
      expect(normalizeToDay(result.nextDue).getDate()).toBe(20); // still the 20th
      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-04-20T00:00:00").getTime(),
      );
    });

    test("postpone leaves a monthly task untouched when its occurrence is past the window", () => {
      // Next 2024-03-20 is outside the window [03-15, 03-18). Unchanged.
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: "2024-02-20T00:00:00",
          interval_days: 1,
          due_date: null,
          postpone_days: 3,
          recurrence_type: "monthly",
          recurrence_day: 20,
        },
        today,
      );

      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-03-20T00:00:00").getTime(),
      );
    });

    test("postpone keeps day-31 clamping when advancing a whole month", () => {
      // Monthly on the 31st. Completed Jan 31 → next Feb 29 (clamped, leap year),
      // inside the window [01-20, 03-05). Advancing one month re-clamps day 31 to
      // March's length → 2024-03-31, not Feb 29 + 1 month of raw days.
      const result = calculateTaskStatus(
        {
          is_recurring: 1,
          last_completed_at: "2024-01-31T00:00:00",
          interval_days: 1,
          due_date: null,
          postpone_days: 45,
          recurrence_type: "monthly",
          recurrence_day: 31,
        },
        new Date("2024-01-20T00:00:00"),
      );

      expect(normalizeToDay(result.nextDue).getTime()).toBe(
        new Date("2024-03-31T00:00:00").getTime(),
      );
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

  test("valid weekly task passes", () => {
    const result = validateTaskData({
      name: "Trash",
      is_recurring: true,
      recurrence_type: "weekly",
      recurrence_day: 1,
      interval_days: 1,
    });

    expect(result.valid).toBe(true);
  });

  test("weekly task without a valid weekday fails", () => {
    const result = validateTaskData({
      name: "Trash",
      is_recurring: true,
      recurrence_type: "weekly",
      recurrence_day: null,
      interval_days: 1,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe("A valid weekday is required for weekly tasks");
  });

  test("weekly task with out-of-range weekday fails", () => {
    const result = validateTaskData({
      name: "Trash",
      is_recurring: true,
      recurrence_type: "weekly",
      recurrence_day: 7,
      interval_days: 1,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe("A valid weekday is required for weekly tasks");
  });

  test("valid monthly task passes", () => {
    const result = validateTaskData({
      name: "Rent",
      is_recurring: true,
      recurrence_type: "monthly",
      recurrence_day: 1,
      interval_days: 1,
    });

    expect(result.valid).toBe(true);
  });

  test("monthly task with day out of 1..31 fails", () => {
    const result = validateTaskData({
      name: "Rent",
      is_recurring: true,
      recurrence_type: "monthly",
      recurrence_day: 32,
      interval_days: 1,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      "A valid day of month is required for monthly tasks",
    );
  });

  test("day-anchored task with N < 1 fails", () => {
    const result = validateTaskData({
      name: "Trash",
      is_recurring: true,
      recurrence_type: "weekly",
      recurrence_day: 1,
      interval_days: 0,
    });

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Repeat count must be at least 1");
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
