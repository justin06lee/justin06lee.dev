import { NextRequest, NextResponse } from "next/server";
import { requireAdminWithMutationRate } from "@/lib/auth";
import { startActual } from "@/lib/calendar";
import { getSiteConfig, resolveTimezone } from "@/lib/site-config";
import { MAX_TITLE_LEN, isStringWithin } from "@/lib/calendar-validate";
import { MAX_TRACK, PRIMARY_TRACK, isValidTrack } from "@/lib/calendar-constants";

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

  // Empty string is a valid string within length, but startActual's existence
  // checks treat it as falsy and skip validation — normalize to undefined so an
  // empty reference id can't be stored as an invalid plan/category pointer.
  const planId = isStringWithin(body.planId, MAX_TITLE_LEN) && body.planId.length > 0 ? body.planId : undefined;
  const categoryId =
    body.categoryId === null
      ? null
      : isStringWithin(body.categoryId, MAX_TITLE_LEN) && body.categoryId.length > 0
        ? body.categoryId
        : undefined;
  const title =
    body.title === null ? null : isStringWithin(body.title, MAX_TITLE_LEN) ? body.title : undefined;

  // Omitted track means the primary lane, preserving the single-timer
  // behaviour for clients that predate parallel tracks. An out-of-range track
  // is rejected outright rather than clamped, so a client bug surfaces instead
  // of quietly filing time under the wrong lane.
  if (body.track !== undefined && !isValidTrack(body.track)) {
    return NextResponse.json(
      { error: `track must be an integer between ${PRIMARY_TRACK} and ${MAX_TRACK}` },
      { status: 400 },
    );
  }
  const track = body.track === undefined ? PRIMARY_TRACK : (body.track as number);

  const config = await getSiteConfig();
  const tz = resolveTimezone(config);
  const result = await startActual({ planId, categoryId, title, timezone: tz, track });
  if (!result.ok) {
    if (result.reason === "concurrent-start") {
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }
    // invalid-category / invalid-plan are 400.
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  return NextResponse.json(result);
}
