import { describe, expect, test } from "bun:test";
import {
  addDays,
  addMonthsClamped,
  clampDayOfMonth,
  daysInMonth,
  getToday,
  monthlyDateInMonth,
  nearestMonthlyDay,
  nearestWeekday,
  nextWeekdayOnOrAfter,
  normalizeToDay,
} from "../../utils/date";

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

describe("daysInMonth", () => {
  test("returns 29 for February in a leap year", () => {
    expect(daysInMonth(2024, 1)).toBe(29);
  });

  test("returns 28 for February in a non-leap year", () => {
    expect(daysInMonth(2023, 1)).toBe(28);
  });

  test("returns 30 for April", () => {
    expect(daysInMonth(2024, 3)).toBe(30);
  });

  test("returns 31 for January", () => {
    expect(daysInMonth(2024, 0)).toBe(31);
  });
});

describe("nextWeekdayOnOrAfter", () => {
  // 2024-03-15 is a Friday (day 5)
  const friday = new Date("2024-03-15T00:00:00");

  test("returns the same day when from is already the weekday", () => {
    const result = nextWeekdayOnOrAfter(friday, 5);
    expect(result.getTime()).toBe(friday.getTime());
  });

  test("returns the next Monday after a Friday", () => {
    const result = nextWeekdayOnOrAfter(friday, 1);
    expect(result.getTime()).toBe(new Date("2024-03-18T00:00:00").getTime());
  });

  test("wraps to next week for a weekday just behind", () => {
    // Thursday (day 4) after a Friday is 6 days ahead
    const result = nextWeekdayOnOrAfter(friday, 4);
    expect(result.getTime()).toBe(new Date("2024-03-21T00:00:00").getTime());
  });
});

describe("nearestWeekday", () => {
  const friday = new Date("2024-03-15T00:00:00");

  test("snaps forward when the weekday is within 3 days ahead", () => {
    // Monday is 3 days ahead → forward
    const result = nearestWeekday(friday, 1);
    expect(result.getTime()).toBe(new Date("2024-03-18T00:00:00").getTime());
  });

  test("snaps backward when the weekday is more than 3 days ahead", () => {
    // Tuesday (day 2) is 4 days ahead → snap back 3 days to last Tuesday
    const result = nearestWeekday(friday, 2);
    expect(result.getTime()).toBe(new Date("2024-03-12T00:00:00").getTime());
  });

  test("returns the same day when from is the weekday", () => {
    const result = nearestWeekday(friday, 5);
    expect(result.getTime()).toBe(friday.getTime());
  });
});

describe("clampDayOfMonth", () => {
  test("clamps day 31 to 29 in a leap-year February", () => {
    expect(clampDayOfMonth(2024, 1, 31)).toBe(29);
  });

  test("clamps day 31 to 30 in April", () => {
    expect(clampDayOfMonth(2024, 3, 31)).toBe(30);
  });

  test("leaves a valid day unchanged", () => {
    expect(clampDayOfMonth(2024, 0, 15)).toBe(15);
  });
});

describe("monthlyDateInMonth", () => {
  test("builds a normalized date at the clamped day", () => {
    const result = monthlyDateInMonth(2024, 1, 31);
    expect(result.getTime()).toBe(new Date("2024-02-29T00:00:00").getTime());
  });
});

describe("nearestMonthlyDay", () => {
  test("picks the current month when it is nearest", () => {
    const from = new Date("2024-03-14T00:00:00");
    const result = nearestMonthlyDay(from, 15);
    expect(result.getTime()).toBe(new Date("2024-03-15T00:00:00").getTime());
  });

  test("picks the next month when its day is nearer", () => {
    // from late in the month, day 1 → next month's 1st is nearest
    const from = new Date("2024-03-30T00:00:00");
    const result = nearestMonthlyDay(from, 1);
    expect(result.getTime()).toBe(new Date("2024-04-01T00:00:00").getTime());
  });

  test("picks the previous month when its day is nearer", () => {
    // from early in the month, day 28 → previous month's 28th is nearest
    const from = new Date("2024-03-02T00:00:00");
    const result = nearestMonthlyDay(from, 28);
    expect(result.getTime()).toBe(new Date("2024-02-28T00:00:00").getTime());
  });
});

describe("addMonthsClamped", () => {
  test("advances one month and clamps day 31 to short month", () => {
    const result = addMonthsClamped(new Date("2024-01-31T00:00:00"), 1, 31);
    expect(result.getTime()).toBe(new Date("2024-02-29T00:00:00").getTime());
  });

  test("advances three months keeping a valid day", () => {
    const result = addMonthsClamped(new Date("2024-03-01T00:00:00"), 3, 1);
    expect(result.getTime()).toBe(new Date("2024-06-01T00:00:00").getTime());
  });

  test("crosses a year boundary", () => {
    const result = addMonthsClamped(new Date("2024-11-15T00:00:00"), 2, 15);
    expect(result.getTime()).toBe(new Date("2025-01-15T00:00:00").getTime());
  });
});
