import { NextRequest, NextResponse } from "next/server";
import { getSiteConfig, updateSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getSiteConfig();
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { description, socials } = body;

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

  return NextResponse.json({ ok: true });
}
