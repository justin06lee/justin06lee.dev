import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const UPLOAD_PATH_RE = /^\/api\/uploads\/[0-9a-f-]{36}$/i;

function isValidBannerUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.startsWith("https://")) return true;
  return UPLOAD_PATH_RE.test(value);
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await initDb();
  const all = req.nextUrl.searchParams.get("all");

  if (all === "1") {
    const authError = await requireAdmin(req);
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
  const authError = await requireAdmin(req);
  if (authError) return authError;

  await initDb();

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { slug, title, excerpt, content, banner_url, tags, published } = body;

  if (
    typeof slug !== "string" ||
    typeof title !== "string" ||
    typeof excerpt !== "string" ||
    typeof content !== "string"
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!/^[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug format" }, { status: 400 });
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

  const publishedAt = published ? new Date().toISOString() : null;

  await db.execute({
    sql: `INSERT INTO articles (slug, title, excerpt, content, banner_url, tags, published, published_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      slug,
      title,
      excerpt,
      content,
      (typeof banner_url === "string" && banner_url) || null,
      JSON.stringify(tagsArray),
      published ? 1 : 0,
      publishedAt,
    ],
  });

  return NextResponse.json({ ok: true });
}
