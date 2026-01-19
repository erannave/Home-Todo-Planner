import { describe, expect, test } from "bun:test";
import { generateSessionId } from "../../utils/session";

describe("generateSessionId", () => {
  test("returns a 64-character hex string", () => {
    const sessionId = generateSessionId();
    expect(sessionId).toHaveLength(64);
    expect(sessionId).toMatch(/^[0-9a-f]{64}$/);
  });

  test("generates unique IDs on each call", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateSessionId());
    }
    expect(ids.size).toBe(100);
  });

  test("generates cryptographically random IDs", () => {
    // Generate many IDs and check they have good entropy
    const ids = Array.from({ length: 1000 }, () => generateSessionId());

    // Check character distribution - each hex char should appear roughly equally
    const charCounts = new Map<string, number>();
    for (const id of ids) {
      for (const char of id) {
        charCounts.set(char, (charCounts.get(char) || 0) + 1);
      }
    }

    // With 1000 IDs of 64 chars each, we have 64000 characters
    // Each of 16 hex chars should appear ~4000 times
    // Allow significant variance but ensure all chars appear
    for (const char of "0123456789abcdef") {
      const count = charCounts.get(char) || 0;
      expect(count).toBeGreaterThan(2000); // At least half of expected
      expect(count).toBeLessThan(6000); // Not too many
    }
  });
});
