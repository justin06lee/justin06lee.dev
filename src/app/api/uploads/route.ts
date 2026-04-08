import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  await initDb();

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const articleSlug = formData.get("article_slug") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();

  if (buffer.byteLength > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
  }
  const base64 = Buffer.from(buffer).toString("base64");
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await db.execute({
    sql: "INSERT INTO uploads (id, filename, mime_type, data, article_slug) VALUES (?, ?, ?, ?, ?)",
    args: [id, file.name, file.type, base64, articleSlug || null],
  });

  return NextResponse.json({ id, url: `/api/uploads/${id}` });
}

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  await initDb();
  const articleSlug = req.nextUrl.searchParams.get("article_slug");

  let result;
  if (articleSlug) {
    result = await db.execute({
      sql: "SELECT id, filename, mime_type, created_at FROM uploads WHERE article_slug = ? ORDER BY created_at DESC",
      args: [articleSlug],
    });
  } else {
    result = await db.execute(
      "SELECT id, filename, mime_type, created_at FROM uploads ORDER BY created_at DESC"
    );
  }

  return NextResponse.json(result.rows);
}
