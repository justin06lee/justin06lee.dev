import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB

function detectMime(buf: Buffer): string | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return "image/gif";
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  await initDb();

  const formData = await req.formData();
  const file = formData.get("file");
  const articleSlugRaw = formData.get("article_slug");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (buffer.byteLength > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
  }

  const detected = detectMime(buffer);
  if (!detected) {
    return NextResponse.json({ error: "Unsupported or unrecognized image format" }, { status: 400 });
  }

  const articleSlug = typeof articleSlugRaw === "string" ? articleSlugRaw : null;

  const base64 = buffer.toString("base64");
  const id = randomUUID();

  await db.execute({
    sql: "INSERT INTO uploads (id, filename, mime_type, data, article_slug) VALUES (?, ?, ?, ?, ?)",
    args: [id, file.name, detected, base64, articleSlug],
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
