import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const ALLOWED_CATEGORIES = ["projects", "hobbies", "in-development"] as const;
type Category = (typeof ALLOWED_CATEGORIES)[number];

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (ALLOWED_CATEGORIES as readonly string[]).includes(value);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  await initDb();
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { category, title, description, year, tech, link, repo, live, notes, sort_order } = body;

  if (
    typeof title !== "string" ||
    typeof description !== "string" ||
    typeof year !== "number" ||
    !Array.isArray(tech) ||
    !tech.every((t) => typeof t === "string")
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!isCategory(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  await db.execute({
    sql: `UPDATE items SET category=?, title=?, description=?, year=?, tech=?, link=?, repo=?, live=?, notes=?, sort_order=?, updated_at=datetime('now')
          WHERE id=?`,
    args: [
      category,
      title,
      description,
      year,
      JSON.stringify(tech),
      typeof link === "string" ? link : null,
      typeof repo === "string" ? repo : null,
      typeof live === "string" ? live : null,
      typeof notes === "string" ? notes : null,
      typeof sort_order === "number" ? sort_order : 0,
      id,
    ],
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  await initDb();
  const { id } = await params;
  await db.execute({ sql: "DELETE FROM items WHERE id = ?", args: [id] });

  return NextResponse.json({ ok: true });
}
