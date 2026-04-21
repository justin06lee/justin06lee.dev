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

export async function checkRateLimit(ip: string): Promise<boolean> {
  await initDb();
  const now = Date.now();
  const windowStart = now - RATE_WINDOW;

  // Prune expired entries
  await db.execute({
    sql: "DELETE FROM login_attempts WHERE first_attempt < ?",
    args: [windowStart],
  });

  const result = await db.execute({
    sql: "SELECT count, first_attempt FROM login_attempts WHERE ip = ?",
    args: [ip],
  });

  const row = result.rows[0] as unknown as { count: number; first_attempt: number } | undefined;
  if (!row || row.first_attempt < windowStart) {
    await db.execute({
      sql: "INSERT OR REPLACE INTO login_attempts (ip, count, first_attempt) VALUES (?, 1, ?)",
      args: [ip, now],
    });
    return true;
  }

  const nextCount = row.count + 1;
  await db.execute({
    sql: "UPDATE login_attempts SET count = ? WHERE ip = ?",
    args: [nextCount, ip],
  });
  return nextCount <= MAX_ATTEMPTS;
}

/* ── Admin verification ── */

export function verifyAdminKey(password: string): boolean {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || typeof password !== "string") return false;
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
