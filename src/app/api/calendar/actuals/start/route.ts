import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { startActual } from "@/lib/calendar";
import { getSiteConfig, resolveTimezone } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // Allow empty body (e.g., quick "start sleep" with no fields).
  }

  const planId = typeof body.planId === "string" ? body.planId : undefined;
  const categoryId =
    body.categoryId === null ? null : typeof body.categoryId === "string" ? body.categoryId : undefined;
  const title =
    body.title === null ? null : typeof body.title === "string" ? body.title : undefined;

  const config = await getSiteConfig();
  const tz = resolveTimezone(config);
  const result = await startActual({ planId, categoryId, title, timezone: tz });
  return NextResponse.json(result);
}
