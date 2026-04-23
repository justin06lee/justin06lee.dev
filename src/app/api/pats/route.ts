import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { getClientIp } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_DELTA_PER_REQUEST = 50;
const RATE_WINDOW_MS = 10_000;
const RATE_MAX_PATS = 100;

const ALLOWED_ORIGINS = new Set([
  "https://justin06lee.dev",
  "https://www.justin06lee.dev",
  "http://localhost:3000",
]);

// Reads the IP's bucket, computes allowed, and writes the new bucket state.
// Allowed can briefly over-consume under concurrent requests from the same IP;
// acceptable for this use case.
const consume = async (ip: string, delta: number): Promise<number> => {
  const now = Date.now();
  const read = await db.execute({
    sql: "SELECT window_start, pats FROM pat_rate WHERE ip = ?",
    args: [ip],
  });
  const row = read.rows[0] as unknown as { window_start: number; pats: number } | undefined;

  let allowed: number;
  let windowStart: number;
  let pats: number;
  if (!row || now - Number(row.window_start) >= RATE_WINDOW_MS) {
    allowed = Math.min(delta, RATE_MAX_PATS);
    windowStart = now;
    pats = allowed;
  } else {
    const remaining = Math.max(0, RATE_MAX_PATS - Number(row.pats));
    allowed = Math.min(delta, remaining);
    windowStart = Number(row.window_start);
    pats = Number(row.pats) + allowed;
  }

  if (allowed > 0) {
    await db.execute({
      sql: `INSERT INTO pat_rate (ip, window_start, pats) VALUES (?, ?, ?)
            ON CONFLICT(ip) DO UPDATE SET window_start = excluded.window_start, pats = excluded.pats`,
      args: [ip, windowStart, pats],
    });
  }
  return allowed;
};

export async function GET() {
  await initDb();
  const res = await db.execute("SELECT count FROM pat_counter WHERE id = 1");
  const row = res.rows[0] as unknown as { count: number } | undefined;
  return NextResponse.json({ count: row?.count ?? 0 });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await initDb();

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const delta = Number((body as { delta?: number })?.delta);
  if (!Number.isFinite(delta) || delta <= 0) {
    return NextResponse.json({ error: "delta must be a positive number" }, { status: 400 });
  }
  const capped = Math.min(Math.floor(delta), MAX_DELTA_PER_REQUEST);
  const allowed = await consume(getClientIp(req), capped);

  if (allowed <= 0) {
    const res = await db.execute("SELECT count FROM pat_counter WHERE id = 1");
    const row = res.rows[0] as unknown as { count: number } | undefined;
    return NextResponse.json({ count: row?.count ?? 0 }, { status: 429 });
  }

  const res = await db.execute({
    sql: "UPDATE pat_counter SET count = count + ? WHERE id = 1 RETURNING count",
    args: [allowed],
  });
  const row = res.rows[0] as unknown as { count: number } | undefined;
  return NextResponse.json({ count: row?.count ?? 0 });
}
