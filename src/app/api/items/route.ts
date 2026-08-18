import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { requireAdminWithMutationRate } from "@/lib/auth";

const ALLOWED_CATEGORIES = ["projects", "hobbies", "in-development"] as const;
type Category = (typeof ALLOWED_CATEGORIES)[number];

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (ALLOWED_CATEGORIES as readonly string[]).includes(value);
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await initDb();
  const category = req.nextUrl.searchParams.get("category");

  if (category) {
    if (!isCategory(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    const result = await db.execute({
      sql: "SELECT * FROM items WHERE category = ? ORDER BY pinned DESC, sort_order ASC, year DESC",
      args: [category],
    });
    return NextResponse.json(result.rows);
  }

  const result = await db.execute("SELECT * FROM items ORDER BY category, pinned DESC, sort_order ASC, year DESC");
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const authError = await requireAdminWithMutationRate(req);
  if (authError) return authError;

  await initDb();

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { id, category, title, description, year, tech, link, repo, live, notes, sort_order, pinned, collection } = body;

  // An empty string passes `typeof id === "string"` but is not a usable slug;
  // reject it explicitly with a clear message instead of storing a blank PK.
  if (typeof id !== "string" || id.length === 0) {
    return NextResponse.json({ error: "id is required and must be a non-empty string" }, { status: 400 });
  }

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

  // ON CONFLICT DO NOTHING turns a duplicate slug into a clean 409 instead of a
  // PRIMARY KEY violation surfacing as an unhandled 500.
  const result = await db.execute({
    sql: `INSERT INTO items (id, category, title, description, year, tech, link, repo, live, notes, sort_order, pinned, collection)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING`,
    args: [
      id,
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
      pinned === true ? 1 : 0,
      typeof collection === "string" && collection.trim() ? collection.trim() : null,
    ],
  });

  if (result.rowsAffected === 0) {
    return NextResponse.json({ error: "an item with that id already exists" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
