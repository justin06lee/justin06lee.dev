import { NextRequest, NextResponse } from "next/server";
import { db, initDb } from "@/lib/db";
import { requireAdminWithMutationRate } from "@/lib/auth";
import { serializePlacement, type Placement } from "@/lib/gallery-wall";
import { updateSiteConfig } from "@/lib/site-config";

/** One project can't plausibly be saved more than this; caps a runaway payload. */
const MAX_LAYOUTS = 500;

/**
 * An override image is either one of our own uploads or an absolute http(s)
 * URL. Anything else — `javascript:`, `data:`, a protocol-relative `//host` —
 * is rejected: this value lands in an <img src> on the public gallery, so a
 * scheme allowlist is the boundary that keeps it inert.
 */
function validImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url) return null;
  if (url.startsWith("//")) return null;
  if (url.startsWith("/")) return url.length <= 512 ? url : null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return url.length <= 512 ? url : null;
  } catch {
    return null;
  }
}

function placementArg(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  return serializePlacement(value as Placement);
}

export async function PUT(req: NextRequest) {
  const authError = await requireAdminWithMutationRate(req);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { layouts, mode } = body;
  if (!Array.isArray(layouts)) {
    return NextResponse.json({ error: "layouts must be an array" }, { status: 400 });
  }
  if (layouts.length > MAX_LAYOUTS) {
    return NextResponse.json({ error: `too many layouts (max ${MAX_LAYOUTS})` }, { status: 400 });
  }
  if (mode !== undefined && mode !== "auto" && mode !== "manual") {
    return NextResponse.json({ error: "mode must be 'auto' or 'manual'" }, { status: 400 });
  }

  await initDb();

  const statements = [];
  for (const raw of layouts) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json({ error: "each layout must be an object" }, { status: 400 });
    }
    const entry = raw as Record<string, unknown>;
    if (typeof entry.id !== "string" || !entry.id) {
      return NextResponse.json({ error: "each layout needs a non-empty id" }, { status: 400 });
    }
    statements.push({
      // Only the wall columns are touched, so a save here can never clobber
      // content edited concurrently in the /me item form.
      sql: `UPDATE items SET wall_desktop = ?, wall_mobile = ?, wall_image = ?, updated_at = datetime('now')
            WHERE id = ?`,
      args: [
        placementArg(entry.desktop),
        placementArg(entry.mobile),
        validImageUrl(entry.image),
        entry.id,
      ],
    });
  }

  // One batch so a partially-applied arrangement can't ship: either the whole
  // wall moves or none of it does.
  if (statements.length > 0) await db.batch(statements, "write");

  // Publishing is part of the same save so the switch can never point at a
  // wall that was not written.
  if (mode !== undefined) await updateSiteConfig("wallMode", mode);

  return NextResponse.json({ ok: true, saved: statements.length });
}
