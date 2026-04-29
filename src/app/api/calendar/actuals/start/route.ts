import { NextRequest, NextResponse } from "next/server";
import { requireAdminWithMutationRate } from "@/lib/auth";
import { startActual } from "@/lib/calendar";
import { getSiteConfig, resolveTimezone } from "@/lib/site-config";
import { MAX_TITLE_LEN, isStringWithin } from "@/lib/calendar-validate";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authError = await requireAdminWithMutationRate(req);
  if (authError) return authError;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // Allow empty body (e.g., quick "start sleep" with no fields).
  }

  const planId = isStringWithin(body.planId, MAX_TITLE_LEN) ? body.planId : undefined;
  const categoryId =
    body.categoryId === null ? null : isStringWithin(body.categoryId, MAX_TITLE_LEN) ? body.categoryId : undefined;
  const title =
    body.title === null ? null : isStringWithin(body.title, MAX_TITLE_LEN) ? body.title : undefined;

  const config = await getSiteConfig();
  const tz = resolveTimezone(config);
  const result = await startActual({ planId, categoryId, title, timezone: tz });
  if (!result.ok) {
    if (result.reason === "concurrent-start") {
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }
    // invalid-category / invalid-plan are 400.
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  return NextResponse.json(result);
}
