import { NextRequest, NextResponse } from "next/server";
import { getSiteConfig, updateSiteConfig } from "@/lib/site-config";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getSiteConfig();
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { description, socials, pfp } = body;

  if (description !== undefined) {
    if (!Array.isArray(description) || !description.every((d) => typeof d === "string")) {
      return NextResponse.json({ error: "description must be an array of strings" }, { status: 400 });
    }
    await updateSiteConfig("description", JSON.stringify(description));
  }

  if (socials !== undefined) {
    if (typeof socials !== "object" || socials === null || Array.isArray(socials)) {
      return NextResponse.json({ error: "socials must be an object" }, { status: 400 });
    }
    const entries = Object.entries(socials as Record<string, unknown>);
    if (!entries.every(([, v]) => typeof v === "string")) {
      return NextResponse.json({ error: "socials values must be strings" }, { status: 400 });
    }
    await updateSiteConfig("socials", JSON.stringify(socials));
  }

  if (pfp !== undefined) {
    if (
      typeof pfp !== "object" ||
      pfp === null ||
      typeof (pfp as { url?: unknown }).url !== "string" ||
      typeof (pfp as { scale?: unknown }).scale !== "number" ||
      typeof (pfp as { x?: unknown }).x !== "number" ||
      typeof (pfp as { y?: unknown }).y !== "number"
    ) {
      return NextResponse.json({ error: "pfp must have { url, scale, x, y }" }, { status: 400 });
    }
    await updateSiteConfig("pfp", JSON.stringify(pfp));
  }

  if (body.prayerLocation !== undefined) {
    const loc = body.prayerLocation as Record<string, unknown>;
    if (
      typeof loc !== "object" ||
      loc === null ||
      typeof loc.city !== "string" ||
      typeof loc.country !== "string" ||
      typeof loc.method !== "number" ||
      typeof loc.timezone !== "string"
    ) {
      return NextResponse.json({ error: "prayerLocation must have { city, country, method, timezone }" }, { status: 400 });
    }
    const prev = (await getSiteConfig()).prayerLocation;
    await updateSiteConfig("prayerLocation", JSON.stringify(loc));
    const changed =
      prev.city !== loc.city || prev.country !== loc.country || prev.method !== loc.method;
    if (changed) {
      const { db, initDb } = await import("@/lib/db");
      await initDb();
      await db.execute("DELETE FROM prayer_times_cache");
    }
  }

  return NextResponse.json({ ok: true });
}
