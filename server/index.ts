import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { db } from "./db";

const app = new Hono();

// CORS for development
app.use("/*", cors());

// Session helpers
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateSessionId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hashPassword(password: string): string {
  return Bun.hash(password).toString(16);
}

function getUserIdFromSession(c: any): number | null {
  const sessionId = getCookie(c, "session_id");
  if (!sessionId) return null;

  const session = db
    .query<{ user_id: number; expires_at: string }, [string]>(
      "SELECT user_id, expires_at FROM sessions WHERE id = ?"
    )
    .get(sessionId);

  if (!session || new Date(session.expires_at) < new Date()) {
    return null;
  }

  return session.user_id;
}

// Auth routes
app.post("/api/register", async (c) => {
  const { email, password } = await c.req.json();

  if (!email || !password || password.length < 6) {
    return c.json({ error: "Invalid email or password (min 6 chars)" }, 400);
  }

  const existing = db
    .query<{ id: number }, [string]>("SELECT id FROM users WHERE email = ?")
    .get(email.toLowerCase());

  if (existing) {
    return c.json({ error: "Email already registered" }, 400);
  }

  const result = db.run(
    "INSERT INTO users (email, password_hash) VALUES (?, ?)",
    [email.toLowerCase(), hashPassword(password)]
  );

  const userId = Number(result.lastInsertRowid);
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  db.run("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [
    sessionId,
    userId,
    expiresAt,
  ]);

  setCookie(c, "session_id", sessionId, {
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
    maxAge: SESSION_DURATION_MS / 1000,
    path: "/",
  });

  return c.json({ success: true, email: email.toLowerCase() });
});

app.post("/api/login", async (c) => {
  const { email, password } = await c.req.json();

  const user = db
    .query<{ id: number; email: string; password_hash: string }, [string]>(
      "SELECT id, email, password_hash FROM users WHERE email = ?"
    )
    .get(email?.toLowerCase());

  if (!user || hashPassword(password) !== user.password_hash) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  db.run("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)", [
    sessionId,
    user.id,
    expiresAt,
  ]);

  setCookie(c, "session_id", sessionId, {
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
    maxAge: SESSION_DURATION_MS / 1000,
    path: "/",
  });

  return c.json({ success: true, email: user.email });
});

app.post("/api/logout", async (c) => {
  const sessionId = getCookie(c, "session_id");
  if (sessionId) {
    db.run("DELETE FROM sessions WHERE id = ?", [sessionId]);
  }
  deleteCookie(c, "session_id");
  return c.json({ success: true });
});

app.get("/api/me", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) {
    return c.json({ user: null });
  }

  const user = db
    .query<{ id: number; email: string }, [number]>(
      "SELECT id, email FROM users WHERE id = ?"
    )
    .get(userId);

  return c.json({ user });
});

// Tasks routes
app.get("/api/tasks", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const tasks = db
    .query<any, [number]>(
      `SELECT
        t.id, t.name, t.notes, t.interval_days,
        t.category_id, c.name as category_name, c.color as category_color,
        t.assigned_member_id, m.name as assigned_member_name,
        t.last_completed_at, t.created_at
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN household_members m ON t.assigned_member_id = m.id
      WHERE t.user_id = ?
      ORDER BY t.name`
    )
    .all(userId);

  // Add status and next_due
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const tasksWithStatus = tasks.map((task) => {
    let status: "done" | "pending" | "overdue";
    let nextDue: Date;

    if (!task.last_completed_at) {
      status = "overdue";
      nextDue = today;
    } else {
      const lastCompleted = new Date(task.last_completed_at);
      nextDue = new Date(lastCompleted);
      nextDue.setDate(nextDue.getDate() + task.interval_days);

      const nextDueDay = new Date(
        nextDue.getFullYear(),
        nextDue.getMonth(),
        nextDue.getDate()
      );

      if (nextDueDay > today) {
        status = "done";
      } else if (nextDueDay.getTime() === today.getTime()) {
        status = "pending";
      } else {
        status = "overdue";
      }
    }

    return { ...task, status, next_due: nextDue.toISOString() };
  });

  return c.json(tasksWithStatus);
});

app.post("/api/tasks", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { name, notes, interval_days, category_id, assigned_member_id } =
    await c.req.json();

  if (!name || !interval_days) {
    return c.json({ error: "Name and interval are required" }, 400);
  }

  const result = db.run(
    `INSERT INTO tasks (user_id, name, notes, interval_days, category_id, assigned_member_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, name, notes || null, interval_days, category_id || null, assigned_member_id || null]
  );

  return c.json({ id: Number(result.lastInsertRowid) });
});

app.put("/api/tasks/:id", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  const { name, notes, interval_days, category_id, assigned_member_id } =
    await c.req.json();

  db.run(
    `UPDATE tasks
     SET name = ?, notes = ?, interval_days = ?, category_id = ?, assigned_member_id = ?
     WHERE id = ? AND user_id = ?`,
    [name, notes || null, interval_days, category_id || null, assigned_member_id || null, id, userId]
  );

  return c.json({ success: true });
});

app.delete("/api/tasks/:id", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  db.run("DELETE FROM tasks WHERE id = ? AND user_id = ?", [id, userId]);

  return c.json({ success: true });
});

app.post("/api/tasks/:id/complete", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  const { completed_by_member_id, notes } = await c.req.json();

  // Verify task belongs to user
  const task = db
    .query<{ id: number }, [number, number]>(
      "SELECT id FROM tasks WHERE id = ? AND user_id = ?"
    )
    .get(id, userId);

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  const now = new Date().toISOString();

  db.run(
    `INSERT INTO task_completions (task_id, completed_by_member_id, completed_at, notes)
     VALUES (?, ?, ?, ?)`,
    [id, completed_by_member_id || null, now, notes || null]
  );

  db.run("UPDATE tasks SET last_completed_at = ? WHERE id = ?", [now, id]);

  return c.json({ success: true });
});

// Completion history
app.get("/api/history", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const history = db
    .query<any, [number]>(
      `SELECT
        tc.id, tc.task_id, t.name as task_name,
        m.name as completed_by_name, tc.completed_at, tc.notes
      FROM task_completions tc
      JOIN tasks t ON tc.task_id = t.id
      LEFT JOIN household_members m ON tc.completed_by_member_id = m.id
      WHERE t.user_id = ?
      ORDER BY tc.completed_at DESC
      LIMIT 100`
    )
    .all(userId);

  return c.json(history);
});

// Members routes
app.get("/api/members", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const members = db
    .query<any, [number]>(
      "SELECT id, name, created_at FROM household_members WHERE user_id = ? ORDER BY name"
    )
    .all(userId);

  return c.json(members);
});

app.post("/api/members", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { name } = await c.req.json();
  if (!name) return c.json({ error: "Name is required" }, 400);

  const result = db.run(
    "INSERT INTO household_members (user_id, name) VALUES (?, ?)",
    [userId, name]
  );

  return c.json({ id: Number(result.lastInsertRowid) });
});

app.put("/api/members/:id", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  const { name } = await c.req.json();

  db.run(
    "UPDATE household_members SET name = ? WHERE id = ? AND user_id = ?",
    [name, id, userId]
  );

  return c.json({ success: true });
});

app.delete("/api/members/:id", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  db.run("DELETE FROM household_members WHERE id = ? AND user_id = ?", [id, userId]);

  return c.json({ success: true });
});

// Categories routes
app.get("/api/categories", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const categories = db
    .query<any, [number]>(
      "SELECT id, name, color, created_at FROM categories WHERE user_id = ? ORDER BY name"
    )
    .all(userId);

  return c.json(categories);
});

app.post("/api/categories", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { name, color } = await c.req.json();
  if (!name) return c.json({ error: "Name is required" }, 400);

  const result = db.run(
    "INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)",
    [userId, name, color || "#6b7280"]
  );

  return c.json({ id: Number(result.lastInsertRowid) });
});

app.put("/api/categories/:id", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  const { name, color } = await c.req.json();

  db.run(
    "UPDATE categories SET name = ?, color = ? WHERE id = ? AND user_id = ?",
    [name, color || "#6b7280", id, userId]
  );

  return c.json({ success: true });
});

app.delete("/api/categories/:id", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  db.run("DELETE FROM categories WHERE id = ? AND user_id = ?", [id, userId]);

  return c.json({ success: true });
});

// Serve static files from public directory
app.use("/*", serveStatic({ root: "./public" }));

// Fallback to index.html for SPA routing
app.get("*", serveStatic({ path: "./public/index.html" }));

const port = process.env.PORT || 3000;
console.log(`Server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
