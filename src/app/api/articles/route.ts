import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { invalidateArticlesCache } from "@/lib/articles";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await initDb();
  const all = req.nextUrl.searchParams.get("all");

  if (all === "1") {
    // Admin: return all articles including drafts — requires auth
    const authError = requireAdmin(req);
    if (authError) return authError;

    const result = await db.execute(
      "SELECT * FROM articles ORDER BY created_at DESC"
    );
    return NextResponse.json(result.rows);
  }

  const result = await db.execute(
    "SELECT * FROM articles WHERE published = 1 ORDER BY published_at DESC, created_at DESC"
  );
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  await initDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { slug, title, excerpt, content, banner_url, tags, published } = body;

  if (!slug || !title || !excerpt || !content) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const publishedAt = published ? new Date().toISOString() : null;

  await db.execute({
    sql: `INSERT INTO articles (slug, title, excerpt, content, banner_url, tags, published, published_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      slug,
      title,
      excerpt,
      content,
      banner_url || null,
      JSON.stringify(tags || []),
      published ? 1 : 0,
      publishedAt,
    ],
  });

  invalidateArticlesCache();
  return NextResponse.json({ ok: true });
}
