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

// Atomically consumes up to `delta` pats from the IP's window and returns how
// many were allowed. Two hardening fixes over the old read-then-write:
//   1. Prune expired buckets so pat_rate can't grow unboundedly (login_attempts
//      and api_mutation_rate already do this — pat_rate was the odd one out).
//   2. Single-statement upsert with RETURNING (same pattern as
//      checkApiMutationRate): a non-atomic SELECT-then-write lets two concurrent
//      requests from one IP both read the same count and both credit the shared
//      counter, exceeding RATE_MAX_PATS. `pats` accumulates the requested delta;
//      the cap is applied when deriving `allowed`, so the grant stays exact
//      (including partial grants at the boundary) without needing the old value.
const consume = async (ip: string, delta: number): Promise<number> => {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;

  await db.execute({
    sql: "DELETE FROM pat_rate WHERE window_start < ?",
    args: [windowStart],
  });

  const res = await db.execute({
    sql: `INSERT INTO pat_rate (ip, window_start, pats) VALUES (?, ?, ?)
          ON CONFLICT(ip) DO UPDATE SET
            pats = CASE WHEN pat_rate.window_start < ? THEN ? ELSE pat_rate.pats + ? END,
            window_start = CASE WHEN pat_rate.window_start < ? THEN ? ELSE pat_rate.window_start END
          RETURNING pats`,
    args: [ip, now, delta, windowStart, delta, delta, windowStart, now],
  });
  const newPats = Number((res.rows[0] as unknown as { pats: number }).pats);

  // allowed = (granted after this request) − (granted before it). Because
  // `pats` stores the cumulative *requested* total, prevTotal = newPats − delta
  // holds in both the reset branch (prevTotal 0) and the accumulate branch, so
  // this is exact under the RATE_MAX_PATS cap.
  return Math.min(newPats, RATE_MAX_PATS) - Math.min(newPats - delta, RATE_MAX_PATS);
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

  // Reject oversized bodies before buffering: the payload is a tiny {delta}
  // object, so a large body is abuse. Cheap DoS guard on this public endpoint.
  if (Number(req.headers.get("content-length")) > 1024) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
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
