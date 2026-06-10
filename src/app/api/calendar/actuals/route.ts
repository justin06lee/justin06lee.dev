import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminWithMutationRate } from "@/lib/auth";
import { getActualsInRange, createActual } from "@/lib/calendar";
import { isValidDateString } from "@/lib/calendar-dates";
import { getSiteConfig, resolveTimezone } from "@/lib/site-config";
import {
  MAX_NOTES_LEN,
  MAX_TITLE_LEN,
  checkDateRangeSpan,
  isFiniteEpochMs,
  isStringWithin,
} from "@/lib/calendar-validate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to || !isValidDateString(from) || !isValidDateString(to)) {
    return NextResponse.json({ error: "from and to must be YYYY-MM-DD" }, { status: 400 });
  }
  const spanError = checkDateRangeSpan(from, to);
  if (spanError) return NextResponse.json({ error: spanError }, { status: 400 });
  const actuals = await getActualsInRange(from, to);
  return NextResponse.json(actuals);
}

// Coerce a JSON value into `string | null | undefined`, with optional length cap.
// Any other shape is treated as "not provided" so the lib applies its default.
function coerceNullableString(v: unknown, max: number): string | null | undefined {
  if (v === null) return null;
  if (typeof v === "string") {
    if (v.length > max) return undefined; // caller validates and rejects below
    // Normalize empty string to null so foreign-key existence checks
    // (categoryExists/planExists) aren't bypassed by a falsy-but-present value.
    return v.length > 0 ? v : null;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const authError = await requireAdminWithMutationRate(req);
  if (authError) return authError;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { startAt, endAt } = body;
  if (!isFiniteEpochMs(startAt) || !isFiniteEpochMs(endAt)) {
    return NextResponse.json({ error: "startAt and endAt must be finite epoch ms in 2001..2100" }, { status: 400 });
  }
  if (typeof body.title === "string" && !isStringWithin(body.title, MAX_TITLE_LEN)) {
    return NextResponse.json({ error: `title must be <= ${MAX_TITLE_LEN} chars` }, { status: 400 });
  }
  if (typeof body.notes === "string" && !isStringWithin(body.notes, MAX_NOTES_LEN)) {
    return NextResponse.json({ error: `notes must be <= ${MAX_NOTES_LEN} chars` }, { status: 400 });
  }

  const config = await getSiteConfig();
  const tz = resolveTimezone(config);
  const result = await createActual({
    startAt,
    endAt,
    categoryId: coerceNullableString(body.categoryId, MAX_TITLE_LEN),
    title: coerceNullableString(body.title, MAX_TITLE_LEN),
    notes: coerceNullableString(body.notes, MAX_NOTES_LEN),
    planId: coerceNullableString(body.planId, MAX_TITLE_LEN),
    timezone: tz,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  return NextResponse.json(result.actual);
}
