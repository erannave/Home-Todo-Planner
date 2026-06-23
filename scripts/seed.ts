import { Database } from "bun:sqlite";

const db = new Database("data/chores.db", { create: true });

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
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
    postpone_days INTEGER NOT NULL DEFAULT 0,
    recurrence_type TEXT NOT NULL DEFAULT 'interval',
    recurrence_day INTEGER,
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
  .query("SELECT id FROM users WHERE username = ?")
  .get("demo");

if (!existingUser) {
  const passwordHash = await Bun.password.hash("demo123", {
    algorithm: "argon2id",
  });
  const result = db.run(
    "INSERT INTO users (username, password_hash) VALUES (?, ?)",
    ["demo", passwordHash],
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
  const t1 = db.run(
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

  const t2 = db.run(
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

  const t3 = db.run(
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

  const t4 = db.run(
    "INSERT INTO tasks (user_id, name, notes, interval_days, is_recurring, category_id, assigned_member_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [userId, "Mow the lawn", null, 14, 1, gardenId, members[2].id],
  );

  const t5 = db.run(
    "INSERT INTO tasks (user_id, name, notes, interval_days, is_recurring, category_id) VALUES (?, ?, ?, ?, ?, ?)",
    [userId, "Take out trash", null, 2, 1, kitchenId],
  );

  // Day-anchored recurring tasks
  db.run(
    "INSERT INTO tasks (user_id, name, notes, interval_days, is_recurring, category_id, recurrence_type, recurrence_day) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      userId,
      "Recycling pickup",
      "Wheel the bin out Monday morning",
      1,
      1,
      kitchenId,
      "weekly",
      1,
    ],
  );

  db.run(
    "INSERT INTO tasks (user_id, name, notes, interval_days, is_recurring, recurrence_type, recurrence_day) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [userId, "Pay rent", "Due on the 1st", 1, 1, "monthly", 1],
  );

  // --- Generate History for the last 60 days ---
  const insertCompletion = db.prepare(
    "INSERT INTO task_completions (task_id, completed_by_member_id, completed_at, notes) VALUES (?, ?, ?, ?)",
  );

  // Clean kitchen counters (Interval 1) - actually done every ~1.5 days on average (unhealthy)
  let d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  while (d < yesterday) {
    insertCompletion.run(
      t1.lastInsertRowid,
      members[0].id,
      d.toISOString(),
      null,
    );
    d = new Date(d.getTime() + (Math.random() * 2 + 0.5) * 24 * 60 * 60 * 1000); // 0.5 to 2.5 days
  }

  // Vacuum living room (Interval 3) - done perfectly every 3 days (healthy)
  d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  while (d < threeDaysAgo) {
    insertCompletion.run(t2.lastInsertRowid, null, d.toISOString(), null);
    d = new Date(d.getTime() + 3 * 24 * 60 * 60 * 1000);
  }

  // Clean bathroom (Interval 7) - done every 10 days (unhealthy)
  d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  while (d < weekAgo) {
    insertCompletion.run(
      t3.lastInsertRowid,
      members[1].id,
      d.toISOString(),
      "Hated it",
    );
    d = new Date(d.getTime() + (Math.random() * 4 + 8) * 24 * 60 * 60 * 1000); // 8 to 12 days
  }

  // Mow the lawn (Interval 14) - done every 12 days (healthy)
  d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  while (d < yesterday) {
    // completed yesterday maybe?
    insertCompletion.run(
      t4.lastInsertRowid,
      members[2].id,
      d.toISOString(),
      "Looks good",
    );
    d = new Date(d.getTime() + (Math.random() * 4 + 10) * 24 * 60 * 60 * 1000); // 10 to 14 days
  }

  // Take out trash (Interval 2) - done every 2.5 days
  d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  while (d < yesterday) {
    insertCompletion.run(t5.lastInsertRowid, null, d.toISOString(), null);
    d = new Date(d.getTime() + (Math.random() * 2 + 1.5) * 24 * 60 * 60 * 1000); // 1.5 to 3.5 days
  }

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
  console.log("Demo user: demo / demo123");
} else {
  console.log("Database already seeded.");
}
