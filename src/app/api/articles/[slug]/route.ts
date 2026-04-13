import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { isAdmin, requireAdmin } from "@/lib/auth";

const UPLOAD_PATH_RE = /^\/api\/uploads\/[0-9a-f-]{36}$/i;

function isValidBannerUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.startsWith("https://")) return true;
  return UPLOAD_PATH_RE.test(value);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  await initDb();
  const { slug } = await params;

  const admin = await isAdmin(req);
  const sql = admin
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
  const authError = await requireAdmin(req);
  if (authError) return authError;

  await initDb();
  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { title, excerpt, content, banner_url, tags, published } = body;

  if (typeof title !== "string" || typeof excerpt !== "string" || typeof content !== "string") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (banner_url !== undefined && banner_url !== null && banner_url !== "" && !isValidBannerUrl(banner_url)) {
    return NextResponse.json({ error: "banner_url must be an https URL or /api/uploads/<uuid>" }, { status: 400 });
  }

  let tagsArray: string[] = [];
  if (tags !== undefined && tags !== null) {
    if (!Array.isArray(tags) || !tags.every((t) => typeof t === "string")) {
      return NextResponse.json({ error: "tags must be an array of strings" }, { status: 400 });
    }
    tagsArray = tags;
  }

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
      (typeof banner_url === "string" && banner_url) || null,
      JSON.stringify(tagsArray),
      published ? 1 : 0,
      publishedAt,
      slug,
    ],
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  await initDb();
  const { slug } = await params;
  await db.execute({ sql: "DELETE FROM articles WHERE slug = ?", args: [slug] });

  return NextResponse.json({ ok: true });
}
