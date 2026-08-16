import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { requireAdminWithMutationRate } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb();
  const { id } = await params;

  // Validate ID format to prevent enumeration
  if (!/^[\w-]+$/.test(id)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const result = await db.execute({
    sql: "SELECT mime_type, data FROM uploads WHERE id = ?",
    args: [id],
  });

  if (result.rows.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  const row = result.rows[0] as unknown as { mime_type: string; data: string };
  const buffer = Buffer.from(row.data, "base64");

  // Serve-time allowlist: legacy rows may hold a dangerous stored mime type
  // (e.g. image/svg+xml from before the ingest allowlist tightened), and a
  // browser navigating to such a URL would execute inline SVG script on our
  // origin. Revalidating here neutralizes any bad stored value without needing
  // to touch the DB — anything outside the allowlist downgrades to a benign,
  // non-rendering octet-stream. The CSP + sandbox and inline Content-Disposition
  // further ensure the response can never execute script even if served.
  const SAFE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
  const ct = SAFE.has(row.mime_type) ? row.mime_type : "application/octet-stream";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": ct,
      "Content-Disposition": 'inline; filename="upload"',
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdminWithMutationRate(req);
  if (authError) return authError;

  await initDb();
  const { id } = await params;
  await db.execute({ sql: "DELETE FROM uploads WHERE id = ?", args: [id] });
  return NextResponse.json({ ok: true });
}
