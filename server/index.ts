import type { Context } from "hono";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import {
  ALLOW_SIGNUPS,
  PORT,
  SECURE_COOKIES,
  SESSION_DURATION_MS,
} from "./config";
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
} from "./services/auth.service";
import {
  createCategory,
  deleteCategory,
  getCategoriesForUser,
  updateCategory,
} from "./services/category.service";
import {
  clearHistoryForUser,
  deleteHistoryEntry,
  getHistoryEntry,
  getHistoryForUser,
} from "./services/history.service";
import {
  createMember,
  deleteMember,
  getMembersForUser,
  updateMember,
} from "./services/member.service";
import {
  completeTask,
  createTask,
  deleteTask,
  getTaskById,
  getTasksForUser,
  updateTask,
  validateTaskData,
} from "./services/task.service";

const app = new Hono();

// CORS for development
app.use("/*", cors());

// Helper to get user ID from session cookie
function getUserIdFromSession(c: Context): number | null {
  const sessionId = getCookie(c, "session_id");
  if (!sessionId) return null;
  return getUserIdFromSessionId(sessionId);
}

// Health check endpoint
app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Config endpoint for frontend
app.get("/api/config", (c) => {
  return c.json({ allowSignups: ALLOW_SIGNUPS });
});

// Auth routes
app.post("/api/register", async (c) => {
  if (!ALLOW_SIGNUPS) {
    return c.json({ error: "Signups are disabled" }, 403);
  }

  const { username, password } = await c.req.json();

  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    return c.json({ error: usernameValidation.error }, 400);
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return c.json({ error: passwordValidation.error }, 400);
  }

  if (usernameExists(username)) {
    return c.json({ error: "Username already taken" }, 400);
  }

  const passwordHash = await hashPassword(password);
  const userId = createUser(username, passwordHash);
  const { sessionId } = createSession(userId);

  setCookie(c, "session_id", sessionId, {
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: "Lax",
    maxAge: SESSION_DURATION_MS / 1000,
    path: "/",
  });

  return c.json({ success: true, username: username.toLowerCase() });
});

app.post("/api/login", async (c) => {
  const { username, password } = await c.req.json();

  const user = getUserByUsername(username);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: "Invalid username or password" }, 401);
  }

  const { sessionId } = createSession(user.id);

  setCookie(c, "session_id", sessionId, {
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: "Lax",
    maxAge: SESSION_DURATION_MS / 1000,
    path: "/",
  });

  return c.json({ success: true, username: user.username });
});

app.post("/api/logout", async (c) => {
  const sessionId = getCookie(c, "session_id");
  if (sessionId) {
    deleteSession(sessionId);
  }
  deleteCookie(c, "session_id");
  return c.json({ success: true });
});

app.get("/api/me", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) {
    return c.json({ user: null });
  }

  const user = getUserById(userId);
  return c.json({ user });
});

// Tasks routes
app.get("/api/tasks", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const tasks = getTasksForUser(userId);
  return c.json(tasks);
});

app.post("/api/tasks", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const data = await c.req.json();
  const validation = validateTaskData(data);
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  const id = createTask(userId, data);
  return c.json({ id });
});

app.put("/api/tasks/:id", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  const data = await c.req.json();

  const validation = validateTaskData(data);
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  updateTask(id, userId, data);
  return c.json({ success: true });
});

app.delete("/api/tasks/:id", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  deleteTask(id, userId);
  return c.json({ success: true });
});

app.post("/api/tasks/:id/complete", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));

  // Verify task belongs to user
  const task = getTaskById(id, userId);
  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  const data = await c.req.json();
  completeTask(id, data);
  return c.json({ success: true });
});

// Completion history
app.get("/api/history", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const history = getHistoryForUser(userId);
  return c.json(history);
});

app.delete("/api/history/:id", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));

  const entry = getHistoryEntry(id, userId);
  if (!entry) {
    return c.json({ error: "History entry not found" }, 404);
  }

  deleteHistoryEntry(id, entry.task_id);
  return c.json({ success: true });
});

app.delete("/api/history", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  clearHistoryForUser(userId);
  return c.json({ success: true });
});

// Members routes
app.get("/api/members", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const members = getMembersForUser(userId);
  return c.json(members);
});

app.post("/api/members", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { name } = await c.req.json();
  if (!name) return c.json({ error: "Name is required" }, 400);

  const id = createMember(userId, name);
  return c.json({ id });
});

app.put("/api/members/:id", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  const { name } = await c.req.json();

  updateMember(id, userId, name);
  return c.json({ success: true });
});

app.delete("/api/members/:id", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  deleteMember(id, userId);
  return c.json({ success: true });
});

// Categories routes
app.get("/api/categories", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const categories = getCategoriesForUser(userId);
  return c.json(categories);
});

app.post("/api/categories", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { name, color } = await c.req.json();
  if (!name) return c.json({ error: "Name is required" }, 400);

  const id = createCategory(userId, name, color);
  return c.json({ id });
});

app.put("/api/categories/:id", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  const { name, color } = await c.req.json();

  updateCategory(id, userId, name, color);
  return c.json({ success: true });
});

app.delete("/api/categories/:id", async (c) => {
  const userId = getUserIdFromSession(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  deleteCategory(id, userId);
  return c.json({ success: true });
});

// Serve static files from public directory
app.use("/*", serveStatic({ root: "./public" }));

// Fallback to index.html for SPA routing
app.get("*", serveStatic({ path: "./public/index.html" }));

console.log(`Server running on http://localhost:${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
