import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_DELTA_PER_REQUEST = 500;

export async function GET() {
  await initDb();
  const res = await db.execute("SELECT count FROM pat_counter WHERE id = 1");
  const row = res.rows[0] as unknown as { count: number } | undefined;
  return NextResponse.json({ count: row?.count ?? 0 });
}

export async function POST(req: NextRequest) {
  await initDb();

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const delta = Number((body as { delta?: number })?.delta);
  if (!Number.isFinite(delta) || delta <= 0) {
    return NextResponse.json({ error: "delta must be a positive number" }, { status: 400 });
  }
  const safeDelta = Math.min(Math.floor(delta), MAX_DELTA_PER_REQUEST);

  await db.execute({
    sql: "UPDATE pat_counter SET count = count + ? WHERE id = 1",
    args: [safeDelta],
  });
  const res = await db.execute("SELECT count FROM pat_counter WHERE id = 1");
  const row = res.rows[0] as unknown as { count: number } | undefined;
  return NextResponse.json({ count: row?.count ?? 0 });
}
