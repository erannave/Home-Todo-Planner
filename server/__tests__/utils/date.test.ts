import { describe, expect, test } from "bun:test";
import { addDays, getToday, normalizeToDay } from "../../utils/date";

describe("normalizeToDay", () => {
  test("strips time components from date", () => {
    const dateWithTime = new Date("2024-03-15T14:30:45.123Z");
    const normalized = normalizeToDay(dateWithTime);

    expect(normalized.getHours()).toBe(0);
    expect(normalized.getMinutes()).toBe(0);
    expect(normalized.getSeconds()).toBe(0);
    expect(normalized.getMilliseconds()).toBe(0);
  });

  test("preserves year, month, and day", () => {
    const dateWithTime = new Date("2024-03-15T14:30:45.123Z");
    const normalized = normalizeToDay(dateWithTime);

    // Note: getMonth() is 0-indexed
    expect(normalized.getFullYear()).toBe(2024);
    // Date may vary due to timezone, but should be within a day
    expect(normalized.getDate()).toBeGreaterThanOrEqual(14);
    expect(normalized.getDate()).toBeLessThanOrEqual(16);
  });

  test("handles midnight dates", () => {
    const midnight = new Date("2024-03-15T00:00:00.000");
    const normalized = normalizeToDay(midnight);

    expect(normalized.getHours()).toBe(0);
    expect(normalized.getMinutes()).toBe(0);
    expect(normalized.getSeconds()).toBe(0);
  });

  test("handles end of day dates", () => {
    const endOfDay = new Date("2024-03-15T23:59:59.999");
    const normalized = normalizeToDay(endOfDay);

    expect(normalized.getHours()).toBe(0);
    expect(normalized.getMinutes()).toBe(0);
    expect(normalized.getSeconds()).toBe(0);
  });
});

describe("getToday", () => {
  test("returns today's date normalized to midnight", () => {
    const today = getToday();
    const now = new Date();

    expect(today.getFullYear()).toBe(now.getFullYear());
    expect(today.getMonth()).toBe(now.getMonth());
    expect(today.getDate()).toBe(now.getDate());
    expect(today.getHours()).toBe(0);
    expect(today.getMinutes()).toBe(0);
    expect(today.getSeconds()).toBe(0);
  });
});

describe("addDays", () => {
  test("adds positive days correctly", () => {
    const start = new Date("2024-03-15T00:00:00");
    const result = addDays(start, 5);

    expect(result.getDate()).toBe(20);
    expect(result.getMonth()).toBe(2); // March (0-indexed)
  });

  test("adds negative days correctly", () => {
    const start = new Date("2024-03-15T00:00:00");
    const result = addDays(start, -5);

    expect(result.getDate()).toBe(10);
    expect(result.getMonth()).toBe(2); // March
  });

  test("handles month boundaries", () => {
    const endOfMonth = new Date("2024-03-31T00:00:00");
    const result = addDays(endOfMonth, 1);

    expect(result.getDate()).toBe(1);
    expect(result.getMonth()).toBe(3); // April
  });

  test("handles year boundaries", () => {
    const endOfYear = new Date("2024-12-31T00:00:00");
    const result = addDays(endOfYear, 1);

    expect(result.getDate()).toBe(1);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getFullYear()).toBe(2025);
  });

  test("does not mutate original date", () => {
    const original = new Date("2024-03-15T00:00:00");
    const originalTime = original.getTime();
    addDays(original, 5);

    expect(original.getTime()).toBe(originalTime);
  });
});
