import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { invalidateItemsCache } from "@/lib/items";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initDb();
  const { id } = await params;
  const body = await req.json();
  const { category, title, description, year, tech, link, repo, live, notes, sort_order } = body;

  if (!category || !title || !description || year == null || !Array.isArray(tech)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const allowedCategories = ["projects", "hobbies", "in-development"];
  if (!allowedCategories.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  await db.execute({
    sql: `UPDATE items SET category=?, title=?, description=?, year=?, tech=?, link=?, repo=?, live=?, notes=?, sort_order=?, updated_at=datetime('now')
          WHERE id=?`,
    args: [
      category, title, description, year, JSON.stringify(tech),
      link || null, repo || null, live || null, notes || null, sort_order ?? 0, id,
    ],
  });

  invalidateItemsCache();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initDb();
  const { id } = await params;
  await db.execute({ sql: "DELETE FROM items WHERE id = ?", args: [id] });

  invalidateItemsCache();
  return NextResponse.json({ ok: true });
}
