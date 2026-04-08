import { timingSafeEqual, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Pad to equal length to avoid leaking length via timing
  const maxLen = Math.max(bufA.length, bufB.length);
  const paddedA = Buffer.alloc(maxLen);
  const paddedB = Buffer.alloc(maxLen);
  bufA.copy(paddedA);
  bufB.copy(paddedB);
  // Compare padded buffers, but also check original lengths match
  const equal = timingSafeEqual(paddedA, paddedB);
  return equal && bufA.length === bufB.length;
}

/* ── Session store (in-memory, cleared on redeploy) ── */

const sessions = new Map<string, { createdAt: number }>();
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_COOKIE = "admin_session";

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL) sessions.delete(token);
  }
}

export function createSession(): string {
  pruneExpiredSessions();
  const token = randomUUID();
  sessions.set(token, { createdAt: Date.now() });
  return token;
}

export function validateSession(token: string): boolean {
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function destroySession(token: string) {
  sessions.delete(token);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

/* ── Rate limiter (in-memory) ── */

const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const RATE_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();

  // Prune expired entries to prevent unbounded memory growth
  if (loginAttempts.size > 1000) {
    for (const [key, val] of loginAttempts) {
      if (now - val.firstAttempt > RATE_WINDOW) loginAttempts.delete(key);
    }
  }

  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.firstAttempt > RATE_WINDOW) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_ATTEMPTS;
}

/* ── Admin verification ── */

export function verifyAdminKey(password: string): boolean {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || typeof password !== "string") return false;
  return safeCompare(password, adminKey);
}

/**
 * Validate the session cookie. Returns null if valid, or a 401 response if invalid.
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;

  if (sessionToken && validateSession(sessionToken)) {
    return null;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
