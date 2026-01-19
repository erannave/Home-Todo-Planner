import { describe, expect, test } from "bun:test";
import {
  createSession,
  createUser,
  deleteSession,
  getUserById,
  getUserByUsername,
  getUserIdFromSessionId,
  hashPassword,
  usernameExists,
  validatePassword,
  validateUsername,
  verifyPassword,
} from "../../services/auth.service";
import { createTestSession, createTestUser } from "../fixtures";
import { createTestDb } from "../setup";

describe("validateUsername", () => {
  test("accepts valid username", () => {
    const result = validateUsername("john_doe123");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test("accepts minimum length (3 chars)", () => {
    const result = validateUsername("abc");
    expect(result.valid).toBe(true);
  });

  test("accepts maximum length (20 chars)", () => {
    const result = validateUsername("a".repeat(20));
    expect(result.valid).toBe(true);
  });

  test("rejects too short username", () => {
    const result = validateUsername("ab");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("3-20 characters");
  });

  test("rejects too long username", () => {
    const result = validateUsername("a".repeat(21));
    expect(result.valid).toBe(false);
    expect(result.error).toContain("3-20 characters");
  });

  test("rejects username with special characters", () => {
    const result = validateUsername("john@doe");
    expect(result.valid).toBe(false);
  });

  test("rejects username with spaces", () => {
    const result = validateUsername("john doe");
    expect(result.valid).toBe(false);
  });

  test("rejects empty username", () => {
    const result = validateUsername("");
    expect(result.valid).toBe(false);
  });
});

describe("validatePassword", () => {
  test("accepts valid password", () => {
    const result = validatePassword("password123");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test("accepts minimum length (6 chars)", () => {
    const result = validatePassword("123456");
    expect(result.valid).toBe(true);
  });

  test("rejects too short password", () => {
    const result = validatePassword("12345");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("at least 6 characters");
  });

  test("rejects empty password", () => {
    const result = validatePassword("");
    expect(result.valid).toBe(false);
  });
});

describe("password hashing", () => {
  test("hashPassword returns hash different from original", async () => {
    const password = "testpassword";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash).toContain("$argon2id$");
  });

  test("verifyPassword returns true for correct password", async () => {
    const password = "testpassword";
    const hash = await hashPassword(password);

    const result = await verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  test("verifyPassword returns false for incorrect password", async () => {
    const password = "testpassword";
    const hash = await hashPassword(password);

    const result = await verifyPassword("wrongpassword", hash);
    expect(result).toBe(false);
  });

  test("same password generates different hashes (salting)", async () => {
    const password = "testpassword";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);

    // But both should verify correctly
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });
});

describe("user operations", () => {
  test("createUser inserts user into database", () => {
    const db = createTestDb();
    const userId = createUser("testuser", "hashedpassword", db);

    expect(userId).toBeGreaterThan(0);

    const user = db
      .query<{ username: string }, [number]>(
        "SELECT username FROM users WHERE id = ?",
      )
      .get(userId);

    expect(user?.username).toBe("testuser");
  });

  test("createUser lowercases username", () => {
    const db = createTestDb();
    createUser("TestUser", "hashedpassword", db);

    const user = db
      .query<{ username: string }, [string]>(
        "SELECT username FROM users WHERE username = ?",
      )
      .get("testuser");

    expect(user?.username).toBe("testuser");
  });

  test("getUserById returns user", () => {
    const db = createTestDb();
    const userId = createTestUser(db, "testuser");

    const user = getUserById(userId, db);

    expect(user).not.toBeNull();
    expect(user?.id).toBe(userId);
    expect(user?.username).toBe("testuser");
  });

  test("getUserById returns null for non-existent user", () => {
    const db = createTestDb();

    const user = getUserById(999, db);
    expect(user).toBeNull();
  });

  test("getUserByUsername returns user", () => {
    const db = createTestDb();
    createTestUser(db, "testuser");

    const user = getUserByUsername("testuser", db);

    expect(user).not.toBeNull();
    expect(user?.username).toBe("testuser");
  });

  test("getUserByUsername is case-insensitive", () => {
    const db = createTestDb();
    createTestUser(db, "testuser");

    const user = getUserByUsername("TESTUSER", db);
    expect(user).not.toBeNull();
  });

  test("getUserByUsername returns null for non-existent user", () => {
    const db = createTestDb();

    const user = getUserByUsername("nonexistent", db);
    expect(user).toBeNull();
  });

  test("usernameExists returns true for existing username", () => {
    const db = createTestDb();
    createTestUser(db, "testuser");

    expect(usernameExists("testuser", db)).toBe(true);
  });

  test("usernameExists returns false for non-existent username", () => {
    const db = createTestDb();

    expect(usernameExists("nonexistent", db)).toBe(false);
  });

  test("usernameExists is case-insensitive", () => {
    const db = createTestDb();
    createTestUser(db, "testuser");

    expect(usernameExists("TESTUSER", db)).toBe(true);
  });
});

describe("session operations", () => {
  test("createSession returns session ID and expiry", () => {
    const db = createTestDb();
    const userId = createTestUser(db);

    const { sessionId, expiresAt } = createSession(userId, db);

    expect(sessionId).toHaveLength(64);
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  test("createSession inserts session into database", () => {
    const db = createTestDb();
    const userId = createTestUser(db);

    const { sessionId } = createSession(userId, db);

    const session = db
      .query<{ user_id: number }, [string]>(
        "SELECT user_id FROM sessions WHERE id = ?",
      )
      .get(sessionId);

    expect(session?.user_id).toBe(userId);
  });

  test("getUserIdFromSessionId returns user ID for valid session", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const sessionId = createTestSession(db, userId);

    const result = getUserIdFromSessionId(sessionId, db);
    expect(result).toBe(userId);
  });

  test("getUserIdFromSessionId returns null for non-existent session", () => {
    const db = createTestDb();

    const result = getUserIdFromSessionId("nonexistent", db);
    expect(result).toBeNull();
  });

  test("getUserIdFromSessionId returns null for expired session", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const expiredDate = new Date(Date.now() - 1000).toISOString(); // 1 second ago
    const sessionId = createTestSession(
      db,
      userId,
      "expired-session",
      expiredDate,
    );

    const result = getUserIdFromSessionId(sessionId, db);
    expect(result).toBeNull();
  });

  test("deleteSession removes session from database", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const sessionId = createTestSession(db, userId);

    deleteSession(sessionId, db);

    const session = db
      .query<{ id: string }, [string]>("SELECT id FROM sessions WHERE id = ?")
      .get(sessionId);

    expect(session).toBeNull();
  });
});
