import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { requireAdminWithMutationRate } from "@/lib/auth";

const ALLOWED_CATEGORIES = ["projects", "hobbies", "in-development"] as const;
type Category = (typeof ALLOWED_CATEGORIES)[number];

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (ALLOWED_CATEGORIES as readonly string[]).includes(value);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdminWithMutationRate(req);
  if (authError) return authError;

  await initDb();
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { target } = body;
  if (!isCategory(target)) {
    return NextResponse.json({ error: "Invalid target category" }, { status: 400 });
  }

  // Interactive write transaction so the reads (current category, dest max,
  // source order) and the writes (move + compaction) are serialized against
  // any other writer. This closes the read/write race window.
  const tx = await db.transaction("write");
  try {
    const itemRes = await tx.execute({
      sql: "SELECT category FROM items WHERE id = ?",
      args: [id],
    });
    const itemRow = itemRes.rows[0] as unknown as { category: string } | undefined;
    if (!itemRow) {
      await tx.rollback();
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (itemRow.category === target) {
      await tx.rollback();
      return NextResponse.json({ ok: true });
    }
    const sourceCategory = itemRow.category;

    const destRes = await tx.execute({
      sql: "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM items WHERE category = ?",
      args: [target],
    });
    const next_sort_order = Number((destRes.rows[0] as unknown as { next: number | bigint }).next);

    const srcRes = await tx.execute({
      sql: "SELECT id FROM items WHERE category = ? AND id != ? ORDER BY sort_order ASC, year DESC",
      args: [sourceCategory, id],
    });
    const srcIds = (srcRes.rows as unknown as { id: string }[]).map((r) => r.id);

    await tx.execute({
      sql: "UPDATE items SET category = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?",
      args: [target, next_sort_order, id],
    });
    for (let i = 0; i < srcIds.length; i++) {
      await tx.execute({
        sql: "UPDATE items SET sort_order = ?, updated_at = datetime('now') WHERE id = ?",
        args: [i, srcIds[i]],
      });
    }

    await tx.commit();
  } finally {
    tx.close();
  }

  return NextResponse.json({ ok: true });
}
