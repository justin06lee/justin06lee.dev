import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { invalidateItemsCache } from "@/lib/items";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await initDb();
  const category = req.nextUrl.searchParams.get("category");

  if (category) {
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
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initDb();
  const body = await req.json();
  const { id, category, title, description, year, tech, link, repo, live, notes, sort_order } = body;

  if (!id || !category || !title || !description || year == null || !Array.isArray(tech)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const allowedCategories = ["projects", "hobbies", "in-development"];
  if (!allowedCategories.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  await db.execute({
    sql: `INSERT INTO items (id, category, title, description, year, tech, link, repo, live, notes, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, category, title, description, year, JSON.stringify(tech),
      link || null, repo || null, live || null, notes || null, sort_order ?? 0,
    ],
  });

  invalidateItemsCache(category);
  return NextResponse.json({ ok: true });
}
