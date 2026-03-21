import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { invalidateArticlesCache } from "@/lib/articles";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await initDb();
  const all = req.nextUrl.searchParams.get("all");

  if (all === "1") {
    // Admin: return all articles including drafts
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
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initDb();
  const body = await req.json();
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
