import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDb();
  const { id } = await params;

  const result = await db.execute({
    sql: "SELECT mime_type, data FROM uploads WHERE id = ?",
    args: [id],
  });

  if (result.rows.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  const row = result.rows[0] as unknown as { mime_type: string; data: string };
  const buffer = Buffer.from(row.data, "base64");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": row.mime_type,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initDb();
  const { id } = await params;
  await db.execute({ sql: "DELETE FROM uploads WHERE id = ?", args: [id] });
  return NextResponse.json({ ok: true });
}
