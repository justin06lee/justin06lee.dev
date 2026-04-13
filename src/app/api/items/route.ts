import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

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
      sql: "SELECT * FROM items WHERE category = ? ORDER BY sort_order ASC, year DESC",
      args: [category],
    });
    return NextResponse.json(result.rows);
  }

  const result = await db.execute("SELECT * FROM items ORDER BY category, sort_order ASC, year DESC");
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  await initDb();

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { id, category, title, description, year, tech, link, repo, live, notes, sort_order } = body;

  if (
    typeof id !== "string" ||
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
    sql: `INSERT INTO items (id, category, title, description, year, tech, link, repo, live, notes, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ],
  });

  return NextResponse.json({ ok: true });
}
