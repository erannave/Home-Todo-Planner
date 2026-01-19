import { describe, expect, test } from "bun:test";
import {
  createMember,
  deleteMember,
  getMembersForUser,
  updateMember,
} from "../../services/member.service";
import { createTestMember, createTestUser } from "../fixtures";
import { createTestDb } from "../setup";

describe("getMembersForUser", () => {
  test("returns members for user", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    createTestMember(db, userId, "Alice");
    createTestMember(db, userId, "Bob");

    const members = getMembersForUser(userId, db);

    expect(members).toHaveLength(2);
    expect(members.map((m) => m.name)).toContain("Alice");
    expect(members.map((m) => m.name)).toContain("Bob");
  });

  test("returns empty array for user with no members", () => {
    const db = createTestDb();
    const userId = createTestUser(db);

    const members = getMembersForUser(userId, db);

    expect(members).toHaveLength(0);
  });

  test("does not return other users' members", () => {
    const db = createTestDb();
    const userId1 = createTestUser(db, "user1");
    const userId2 = createTestUser(db, "user2");
    createTestMember(db, userId1, "Alice");

    const members = getMembersForUser(userId2, db);

    expect(members).toHaveLength(0);
  });

  test("returns members sorted by name", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    createTestMember(db, userId, "Zoe");
    createTestMember(db, userId, "Alice");
    createTestMember(db, userId, "Mike");

    const members = getMembersForUser(userId, db);

    expect(members[0].name).toBe("Alice");
    expect(members[1].name).toBe("Mike");
    expect(members[2].name).toBe("Zoe");
  });
});

describe("createMember", () => {
  test("inserts member into database", () => {
    const db = createTestDb();
    const userId = createTestUser(db);

    const memberId = createMember(userId, "Alice", db);

    expect(memberId).toBeGreaterThan(0);

    const member = db
      .query<{ name: string }, [number]>(
        "SELECT name FROM household_members WHERE id = ?",
      )
      .get(memberId);

    expect(member?.name).toBe("Alice");
  });
});

describe("updateMember", () => {
  test("updates member name", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const memberId = createTestMember(db, userId, "Alice");

    updateMember(memberId, userId, "Alicia", db);

    const member = db
      .query<{ name: string }, [number]>(
        "SELECT name FROM household_members WHERE id = ?",
      )
      .get(memberId);

    expect(member?.name).toBe("Alicia");
  });

  test("does not update other users' members", () => {
    const db = createTestDb();
    const userId1 = createTestUser(db, "user1");
    const userId2 = createTestUser(db, "user2");
    const memberId = createTestMember(db, userId1, "Alice");

    updateMember(memberId, userId2, "Hacked", db);

    const member = db
      .query<{ name: string }, [number]>(
        "SELECT name FROM household_members WHERE id = ?",
      )
      .get(memberId);

    expect(member?.name).toBe("Alice"); // Unchanged
  });
});

describe("deleteMember", () => {
  test("removes member from database", () => {
    const db = createTestDb();
    const userId = createTestUser(db);
    const memberId = createTestMember(db, userId);

    deleteMember(memberId, userId, db);

    const member = db
      .query<{ id: number }, [number]>(
        "SELECT id FROM household_members WHERE id = ?",
      )
      .get(memberId);

    expect(member).toBeNull();
  });

  test("does not delete other users' members", () => {
    const db = createTestDb();
    const userId1 = createTestUser(db, "user1");
    const userId2 = createTestUser(db, "user2");
    const memberId = createTestMember(db, userId1);

    deleteMember(memberId, userId2, db);

    const member = db
      .query<{ id: number }, [number]>(
        "SELECT id FROM household_members WHERE id = ?",
      )
      .get(memberId);

    expect(member).not.toBeNull();
  });
});
