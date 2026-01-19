// Environment configuration

export const ALLOW_SIGNUPS =
  process.env.ALLOW_SIGNUPS?.toLowerCase() === "true";

// SECURE_COOKIES: Set to "false" for local network HTTP deployments without TLS
// Defaults to true for security - only disable if you understand the risks
export const SECURE_COOKIES =
  process.env.SECURE_COOKIES?.toLowerCase() !== "false";

export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const PORT = process.env.PORT || 3000;
