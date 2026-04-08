import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { invalidateArticlesCache } from "@/lib/articles";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  await initDb();
  const { slug } = await params;

  // If admin, return any article; otherwise only published ones
  const isAdmin = requireAdmin(req) === null;
  const sql = isAdmin
    ? "SELECT * FROM articles WHERE slug = ?"
    : "SELECT * FROM articles WHERE slug = ? AND published = 1";

  const result = await db.execute({ sql, args: [slug] });
  const rows = result.rows;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  await initDb();
  const { slug } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { title, excerpt, content, banner_url, tags, published } = body;

  if (!title || !excerpt || !content) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Validate banner_url if provided: must be a relative path or https URL
  if (banner_url && typeof banner_url === "string") {
    if (!banner_url.startsWith("/") && !banner_url.startsWith("https://")) {
      return NextResponse.json({ error: "banner_url must be a relative path or https URL" }, { status: 400 });
    }
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
  const authError = requireAdmin(req);
  if (authError) return authError;

  await initDb();
  const { slug } = await params;
  await db.execute({ sql: "DELETE FROM articles WHERE slug = ?", args: [slug] });

  invalidateArticlesCache();
  return NextResponse.json({ ok: true });
}
