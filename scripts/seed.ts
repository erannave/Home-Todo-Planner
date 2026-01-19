import { Database } from "bun:sqlite";

const db = new Database("data/chores.db", { create: true });

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS household_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6b7280',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    notes TEXT,
    interval_days INTEGER DEFAULT 7,
    is_recurring INTEGER NOT NULL DEFAULT 1,
    due_date TEXT,
    category_id INTEGER,
    assigned_member_id INTEGER,
    last_completed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_member_id) REFERENCES household_members(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS task_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    completed_by_member_id INTEGER,
    completed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (completed_by_member_id) REFERENCES household_members(id) ON DELETE SET NULL
  );
`);

// Create a demo user (password: demo123)
const existingUser = db
  .query("SELECT id FROM users WHERE email = ?")
  .get("demo@example.com");

if (!existingUser) {
  const passwordHash = await Bun.password.hash("demo123", {
    algorithm: "argon2id",
  });
  const result = db.run(
    "INSERT INTO users (email, password_hash) VALUES (?, ?)",
    ["demo@example.com", passwordHash],
  );
  const userId = Number(result.lastInsertRowid);

  // Add household members
  db.run("INSERT INTO household_members (user_id, name) VALUES (?, ?)", [
    userId,
    "Alice",
  ]);
  db.run("INSERT INTO household_members (user_id, name) VALUES (?, ?)", [
    userId,
    "Bob",
  ]);
  db.run("INSERT INTO household_members (user_id, name) VALUES (?, ?)", [
    userId,
    "Charlie",
  ]);

  // Add categories
  db.run("INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)", [
    userId,
    "Kitchen",
    "#ef4444",
  ]);
  db.run("INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)", [
    userId,
    "Bathroom",
    "#3b82f6",
  ]);
  db.run("INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)", [
    userId,
    "Living Room",
    "#22c55e",
  ]);
  db.run("INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)", [
    userId,
    "Garden",
    "#eab308",
  ]);

  // Get IDs for tasks
  const members = db
    .query("SELECT id FROM household_members WHERE user_id = ?")
    .all(userId) as { id: number }[];
  const categories = db
    .query("SELECT id, name FROM categories WHERE user_id = ?")
    .all(userId) as { id: number; name: string }[];

  const kitchenId = categories.find((c) => c.name === "Kitchen")?.id ?? null;
  const bathroomId = categories.find((c) => c.name === "Bathroom")?.id ?? null;
  const livingRoomId =
    categories.find((c) => c.name === "Living Room")?.id ?? null;
  const gardenId = categories.find((c) => c.name === "Garden")?.id ?? null;

  // Add some tasks
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Recurring tasks
  db.run(
    "INSERT INTO tasks (user_id, name, notes, interval_days, is_recurring, category_id, assigned_member_id, last_completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      userId,
      "Clean kitchen counters",
      "Wipe down all surfaces",
      1,
      1,
      kitchenId,
      members[0].id,
      yesterday.toISOString(),
    ],
  );

  db.run(
    "INSERT INTO tasks (user_id, name, notes, interval_days, is_recurring, category_id, assigned_member_id, last_completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      userId,
      "Vacuum living room",
      null,
      3,
      1,
      livingRoomId,
      null,
      threeDaysAgo.toISOString(),
    ],
  );

  db.run(
    "INSERT INTO tasks (user_id, name, notes, interval_days, is_recurring, category_id, assigned_member_id, last_completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      userId,
      "Clean bathroom",
      "Toilet, sink, and shower",
      7,
      1,
      bathroomId,
      members[1].id,
      weekAgo.toISOString(),
    ],
  );

  db.run(
    "INSERT INTO tasks (user_id, name, notes, interval_days, is_recurring, category_id, assigned_member_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [userId, "Mow the lawn", null, 14, 1, gardenId, members[2].id],
  );

  db.run(
    "INSERT INTO tasks (user_id, name, notes, interval_days, is_recurring, category_id) VALUES (?, ?, ?, ?, ?, ?)",
    [userId, "Take out trash", null, 2, 1, kitchenId],
  );

  // Non-recurring tasks (one-time)
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  db.run(
    "INSERT INTO tasks (user_id, name, notes, interval_days, is_recurring, due_date, category_id, assigned_member_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      userId,
      "Call plumber about leak",
      "Kitchen sink dripping",
      null,
      0,
      tomorrow.toISOString().split("T")[0],
      kitchenId,
      null,
    ],
  );

  db.run(
    "INSERT INTO tasks (user_id, name, notes, interval_days, is_recurring, due_date, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      userId,
      "Schedule annual HVAC maintenance",
      null,
      null,
      0,
      nextWeek.toISOString().split("T")[0],
      null,
    ],
  );

  db.run(
    "INSERT INTO tasks (user_id, name, notes, interval_days, is_recurring, due_date, category_id, assigned_member_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      userId,
      "Fix squeaky door hinge",
      "Master bedroom door",
      null,
      0,
      twoDaysAgo.toISOString().split("T")[0],
      livingRoomId,
      members[1].id,
    ],
  );

  db.run(
    "INSERT INTO tasks (user_id, name, notes, interval_days, is_recurring, category_id) VALUES (?, ?, ?, ?, ?, ?)",
    [userId, "Organize garage shelves", "No rush", null, 0, null],
  );

  console.log("Database seeded successfully!");
  console.log("Demo user: demo@example.com / demo123");
} else {
  console.log("Database already seeded.");
}
