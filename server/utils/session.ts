// Session ID generation utilities

/**
 * Generate a cryptographically secure session ID
 * Returns a 64-character hex string (32 random bytes)
 */
export function generateSessionId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
