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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { description, socials, pfp } = body;

  if (description !== undefined) {
    if (!Array.isArray(description)) {
      return NextResponse.json({ error: "description must be an array of strings" }, { status: 400 });
    }
    await updateSiteConfig("description", JSON.stringify(description));
  }

  if (socials !== undefined) {
    if (typeof socials !== "object" || socials === null) {
      return NextResponse.json({ error: "socials must be an object" }, { status: 400 });
    }
    await updateSiteConfig("socials", JSON.stringify(socials));
  }

  if (pfp !== undefined) {
    if (
      typeof pfp !== "object" ||
      pfp === null ||
      typeof pfp.url !== "string" ||
      typeof pfp.scale !== "number" ||
      typeof pfp.x !== "number" ||
      typeof pfp.y !== "number"
    ) {
      return NextResponse.json({ error: "pfp must have { url, scale, x, y }" }, { status: 400 });
    }
    await updateSiteConfig("pfp", JSON.stringify(pfp));
  }

  return NextResponse.json({ ok: true });
}
