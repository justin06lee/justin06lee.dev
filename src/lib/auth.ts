import "server-only";
import { timingSafeEqual, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";

/**
 * Resolve the client IP from proxy headers. Prefers x-real-ip (set by Vercel
 * and most reverse proxies and not forwarded from the client), falling back to
 * the rightmost value of x-forwarded-for (the hop nearest to us, not the
 * client-controlled leftmost value). Returns "unknown" if neither is present.
 */
export function getClientIp(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }

  return "unknown";
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Pad to equal length so the comparison cost doesn't leak the secret's
  // length: an early `length !== length` return would let an attacker time
  // responses to enumerate the password length. timingSafeEqual still requires
  // equal-length inputs, hence the padding rather than passing raw buffers.
  const maxLen = Math.max(bufA.length, bufB.length);
  const padA = Buffer.alloc(maxLen);
  const padB = Buffer.alloc(maxLen);
  bufA.copy(padA);
  bufB.copy(padB);
  try {
    // Differing lengths must still compare unequal even though the padded
    // buffers match in the padding region.
    return timingSafeEqual(padA, padB) && bufA.length === bufB.length;
  } catch {
    return false;
  }
}

/* ── Session store (DB-backed, survives cold starts / redeploys) ── */

const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_COOKIE = "admin_session";

export async function createSession(): Promise<string> {
  await initDb();
  // Prune expired sessions
  await db.execute({
    sql: "DELETE FROM sessions WHERE created_at < ?",
    args: [Date.now() - SESSION_TTL],
  });
  const token = randomUUID();
  await db.execute({
    sql: "INSERT INTO sessions (token, created_at) VALUES (?, ?)",
    args: [token, Date.now()],
  });
  return token;
}

export async function validateSession(token: string): Promise<boolean> {
  await initDb();
  const result = await db.execute({
    sql: "SELECT created_at FROM sessions WHERE token = ?",
    args: [token],
  });
  if (result.rows.length === 0) return false;
  const createdAt = result.rows[0].created_at as number;
  if (Date.now() - createdAt > SESSION_TTL) {
    await db.execute({ sql: "DELETE FROM sessions WHERE token = ?", args: [token] });
    return false;
  }
  return true;
}

export async function destroySession(token: string) {
  await initDb();
  await db.execute({ sql: "DELETE FROM sessions WHERE token = ?", args: [token] });
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

/* ── Rate limiter (DB-backed; survives serverless cold starts) ── */

const RATE_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;
const LOCKOUT_WINDOW = 24 * 60 * 60 * 1000; // 24 hours once MAX_ATTEMPTS hit

export async function checkRateLimit(ip: string): Promise<boolean> {
  await initDb();
  const now = Date.now();
  const windowStart = now - RATE_WINDOW;
  const lockoutStart = now - LOCKOUT_WINDOW;

  // Prune entries older than the longest retention window
  await db.execute({
    sql: "DELETE FROM login_attempts WHERE first_attempt < ?",
    args: [lockoutStart],
  });

  // Atomic read-modify-write so concurrent attempts from the same IP can't both
  // read the same count and clobber each other's increment (which would let an
  // attacker exceed MAX_ATTEMPTS under load). The CASE order encodes the same
  // precedence as the prior app-level branches:
  //   1. Lockout wins: once count > MAX_ATTEMPTS within LOCKOUT_WINDOW, neither
  //      count nor first_attempt change, so the block persists the full 24h and
  //      the rolling-window reset can't lift it early.
  //   2. Otherwise, an expired rolling window (first_attempt < windowStart)
  //      resets the counter to 1 and re-anchors the window.
  //   3. Otherwise, increment.
  const result = await db.execute({
    sql: `INSERT INTO login_attempts (ip, count, first_attempt) VALUES (?, 1, ?)
          ON CONFLICT(ip) DO UPDATE SET
            count = CASE
              WHEN login_attempts.count > ? AND login_attempts.first_attempt >= ? THEN login_attempts.count
              WHEN login_attempts.first_attempt < ? THEN 1
              ELSE login_attempts.count + 1 END,
            first_attempt = CASE
              WHEN login_attempts.count > ? AND login_attempts.first_attempt >= ? THEN login_attempts.first_attempt
              WHEN login_attempts.first_attempt < ? THEN ?
              ELSE login_attempts.first_attempt END
          RETURNING count`,
    args: [ip, now, MAX_ATTEMPTS, lockoutStart, windowStart, MAX_ATTEMPTS, lockoutStart, windowStart, now],
  });
  const count = Number((result.rows[0] as unknown as { count: number }).count);
  return count <= MAX_ATTEMPTS;
}

/* ── API mutation rate limiter (per-IP, sliding 1-minute window) ── */

const MUTATION_WINDOW_MS = 60 * 1000;
const MUTATION_MAX_PER_WINDOW = 200;

/**
 * Per-IP rate limit for state-changing API calls. Generous threshold —
 * intended to stop runaway scripts and accidental loops, never to inconvenience
 * the human admin (~3/sec sustained still passes). DB-backed so the limit
 * survives serverless cold starts.
 */
export async function checkApiMutationRate(ip: string): Promise<boolean> {
  await initDb();
  const now = Date.now();
  const windowStart = now - MUTATION_WINDOW_MS;

  // Prune stale rows so the table doesn't grow indefinitely.
  await db.execute({
    sql: "DELETE FROM api_mutation_rate WHERE first_attempt < ?",
    args: [windowStart],
  });

  // Atomic read-modify-write: a non-atomic SELECT-then-UPDATE lets two
  // concurrent requests from the same IP both read the same count and both
  // write count+1, lowering the effective count and letting the limit be
  // exceeded. A single upsert with RETURNING closes that window. When the
  // window has expired (first_attempt < windowStart) the counter resets to 1.
  const result = await db.execute({
    sql: `INSERT INTO api_mutation_rate (ip, count, first_attempt) VALUES (?, 1, ?)
          ON CONFLICT(ip) DO UPDATE SET
            count = CASE WHEN api_mutation_rate.first_attempt < ? THEN 1 ELSE api_mutation_rate.count + 1 END,
            first_attempt = CASE WHEN api_mutation_rate.first_attempt < ? THEN ? ELSE api_mutation_rate.first_attempt END
          RETURNING count`,
    args: [ip, now, windowStart, windowStart, now],
  });
  const count = Number((result.rows[0] as unknown as { count: number }).count);
  return count <= MUTATION_MAX_PER_WINDOW;
}

/* ── Admin verification ── */

let warnedMissingAdminKey = false;

export function verifyAdminKey(password: string): boolean {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    if (!warnedMissingAdminKey) {
      warnedMissingAdminKey = true;
      console.warn("[auth] ADMIN_KEY is not set; admin login is disabled.");
    }
    return false;
  }
  if (typeof password !== "string") return false;
  return safeCompare(password, adminKey);
}

export async function isAdmin(req: NextRequest): Promise<boolean> {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return false;
  return validateSession(sessionToken);
}

/**
 * Validate the session cookie. Returns null if valid, or a 401 response if invalid.
 */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  if (await isAdmin(req)) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Like `requireAdmin`, but also enforces the per-IP mutation rate limit.
 * Use on POST/PATCH/DELETE handlers (read-only GETs should stay on
 * `requireAdmin` so they're not throttled alongside writes).
 */
export async function requireAdminWithMutationRate(req: NextRequest): Promise<NextResponse | null> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const ip = getClientIp(req);
  if (!(await checkApiMutationRate(ip))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  return null;
}
