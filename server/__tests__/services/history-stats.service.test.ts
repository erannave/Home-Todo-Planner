import { describe, expect, test } from "bun:test";
import {
  getDayOfWeekStats,
  getWeeklyStats,
} from "../../services/history-stats.service";
import {
  createTestCompletion,
  createTestTask,
  createTestUser,
} from "../fixtures";
import { createTestDb } from "../setup";

describe("getWeeklyStats", () => {
  test("returns empty weeks when no completions", () => {
    const db = createTestDb();
    const userId = createTestUser(db);

    const stats = getWeeklyStats(userId, 12, db);

    expect(stats).toHaveLength(12);
    expect(stats.every((w) => w.count === 0)).toBe(true);
  });

  test("counts completions by week", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const taskId = createTestTask(db, userId);

    // Create completions in different weeks
    const today = new Date();
    createTestCompletion(db, taskId, {
      completed_at: today.toISOString(),
    });
    createTestCompletion(db, taskId, {
      completed_at: today.toISOString(),
    });

    const stats = getWeeklyStats(userId, 12, db);

    // Find the current week (last one)
    const currentWeek = stats[stats.length - 1];
    expect(currentWeek.count).toBe(2);
  });

  test("returns correct number of weeks", () => {
    const db = createTestDb();
    const userId = createTestUser(db);

    const stats4 = getWeeklyStats(userId, 4, db);
    const stats8 = getWeeklyStats(userId, 8, db);

    expect(stats4).toHaveLength(4);
    expect(stats8).toHaveLength(8);
  });

  test("does not include other users' completions", () => {
    const db = createTestDb();
    const userId1 = createTestUser(db, "user1");
    const userId2 = createTestUser(db, "user2");
    const taskId1 = createTestTask(db, userId1);
    const taskId2 = createTestTask(db, userId2);

    createTestCompletion(db, taskId1);
    createTestCompletion(db, taskId2);
    createTestCompletion(db, taskId2);

    const stats1 = getWeeklyStats(userId1, 12, db);
    const stats2 = getWeeklyStats(userId2, 12, db);

    const totalCount1 = stats1.reduce((sum, w) => sum + w.count, 0);
    const totalCount2 = stats2.reduce((sum, w) => sum + w.count, 0);

    expect(totalCount1).toBe(1);
    expect(totalCount2).toBe(2);
  });

  test("includes week_start and week_end dates", () => {
    const db = createTestDb();
    const userId = createTestUser(db);

    const stats = getWeeklyStats(userId, 1, db);

    expect(stats).toHaveLength(1);
    expect(stats[0].week_start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(stats[0].week_end).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Week end should be 6 days after week start
    const start = new Date(stats[0].week_start);
    const end = new Date(stats[0].week_end);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(6);
  });

  test("orders weeks chronologically", () => {
    const db = createTestDb();
    const userId = createTestUser(db);

    const stats = getWeeklyStats(userId, 4, db);

    for (let i = 1; i < stats.length; i++) {
      expect(new Date(stats[i].week_start).getTime()).toBeGreaterThan(
        new Date(stats[i - 1].week_start).getTime(),
      );
    }
  });
});

describe("getDayOfWeekStats", () => {
  test("returns all 7 days even with no completions", () => {
    const db = createTestDb();
    const userId = createTestUser(db);

    const stats = getDayOfWeekStats(userId, db);

    expect(stats).toHaveLength(7);
    expect(stats[0].name).toBe("Sunday");
    expect(stats[6].name).toBe("Saturday");
    expect(stats.every((d) => d.count === 0)).toBe(true);
  });

  test("counts completions by day of week", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const taskId = createTestTask(db, userId);

    // Create a completion on a known day
    // Monday = 2024-01-01
    createTestCompletion(db, taskId, {
      completed_at: "2024-01-01T12:00:00Z",
    });
    createTestCompletion(db, taskId, {
      completed_at: "2024-01-01T14:00:00Z",
    });
    // Wednesday = 2024-01-03
    createTestCompletion(db, taskId, {
      completed_at: "2024-01-03T12:00:00Z",
    });

    const stats = getDayOfWeekStats(userId, db);

    // Monday is day 1
    expect(stats[1].name).toBe("Monday");
    expect(stats[1].count).toBe(2);

    // Wednesday is day 3
    expect(stats[3].name).toBe("Wednesday");
    expect(stats[3].count).toBe(1);

    // Other days should be 0
    expect(stats[0].count).toBe(0); // Sunday
    expect(stats[2].count).toBe(0); // Tuesday
  });

  test("does not include other users' completions", () => {
    const db = createTestDb();
    const userId1 = createTestUser(db, "user1");
    const userId2 = createTestUser(db, "user2");
    const taskId1 = createTestTask(db, userId1);
    const taskId2 = createTestTask(db, userId2);

    createTestCompletion(db, taskId1, {
      completed_at: "2024-01-01T12:00:00Z",
    });
    createTestCompletion(db, taskId2, {
      completed_at: "2024-01-01T12:00:00Z",
    });
    createTestCompletion(db, taskId2, {
      completed_at: "2024-01-01T14:00:00Z",
    });

    const stats1 = getDayOfWeekStats(userId1, db);
    const stats2 = getDayOfWeekStats(userId2, db);

    const totalCount1 = stats1.reduce((sum, d) => sum + d.count, 0);
    const totalCount2 = stats2.reduce((sum, d) => sum + d.count, 0);

    expect(totalCount1).toBe(1);
    expect(totalCount2).toBe(2);
  });

  test("returns days in order from Sunday to Saturday", () => {
    const db = createTestDb();
    const userId = createTestUser(db);

    const stats = getDayOfWeekStats(userId, db);

    expect(stats[0].day).toBe(0);
    expect(stats[0].name).toBe("Sunday");
    expect(stats[1].day).toBe(1);
    expect(stats[1].name).toBe("Monday");
    expect(stats[2].day).toBe(2);
    expect(stats[2].name).toBe("Tuesday");
    expect(stats[3].day).toBe(3);
    expect(stats[3].name).toBe("Wednesday");
    expect(stats[4].day).toBe(4);
    expect(stats[4].name).toBe("Thursday");
    expect(stats[5].day).toBe(5);
    expect(stats[5].name).toBe("Friday");
    expect(stats[6].day).toBe(6);
    expect(stats[6].name).toBe("Saturday");
  });
});
