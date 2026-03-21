import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { invalidateArticlesCache } from "@/lib/articles";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  await initDb();
  const { slug } = await params;
  const result = await db.execute({
    sql: "SELECT * FROM articles WHERE slug = ?",
    args: [slug],
  });
  const rows = result.rows;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initDb();
  const { slug } = await params;
  const body = await req.json();
  const { title, excerpt, content, banner_url, tags, published } = body;

  if (!title || !excerpt || !content) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // If publishing for the first time, set published_at
  const existing = await db.execute({
    sql: "SELECT published, published_at FROM articles WHERE slug = ?",
    args: [slug],
  });
  const row = existing.rows[0] as unknown as { published: number; published_at: string | null } | undefined;
  let publishedAt = row?.published_at ?? null;
  if (published && !publishedAt) {
    publishedAt = new Date().toISOString();
  }

  await db.execute({
    sql: `UPDATE articles SET title=?, excerpt=?, content=?, banner_url=?, tags=?, published=?, published_at=?, updated_at=datetime('now')
          WHERE slug=?`,
    args: [
      title,
      excerpt,
      content,
      banner_url || null,
      JSON.stringify(tags || []),
      published ? 1 : 0,
      publishedAt,
      slug,
    ],
  });

  invalidateArticlesCache();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initDb();
  const { slug } = await params;
  await db.execute({ sql: "DELETE FROM articles WHERE slug = ?", args: [slug] });

  invalidateArticlesCache();
  return NextResponse.json({ ok: true });
}
