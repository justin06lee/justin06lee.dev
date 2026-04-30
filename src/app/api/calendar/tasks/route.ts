import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminWithMutationRate } from "@/lib/auth";
import { createTask, getTasksInRange } from "@/lib/calendar";
import { isValidDateString, isValidHhmm } from "@/lib/calendar-dates";
import {
  MAX_NOTES_LEN,
  MAX_TITLE_LEN,
  checkDateRangeSpan,
  isFiniteInt32,
  isStringWithin,
  parseFallbacksInput,
} from "@/lib/calendar-validate";
import type { PlanFallback } from "@/lib/calendar";

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
  const tasks = await getTasksInRange(from, to);
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const authError = await requireAdminWithMutationRate(req);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { date, title, notes, startTime, endTime, position, categoryId, isUncertain, fallbacks } = body;
  if (typeof date !== "string" || !isValidDateString(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  if (!isStringWithin(title, MAX_TITLE_LEN) || title.trim().length === 0) {
    return NextResponse.json({ error: `title is required (<= ${MAX_TITLE_LEN} chars)` }, { status: 400 });
  }
  if (notes !== undefined && notes !== null && !isStringWithin(notes, MAX_NOTES_LEN)) {
    return NextResponse.json({ error: `notes must be <= ${MAX_NOTES_LEN} chars` }, { status: 400 });
  }
  if (startTime !== undefined && startTime !== null && (typeof startTime !== "string" || !isValidHhmm(startTime))) {
    return NextResponse.json({ error: "startTime must be HH:MM" }, { status: 400 });
  }
  if (endTime !== undefined && endTime !== null && (typeof endTime !== "string" || !isValidHhmm(endTime))) {
    return NextResponse.json({ error: "endTime must be HH:MM" }, { status: 400 });
  }
  if (position !== undefined && !isFiniteInt32(position)) {
    return NextResponse.json({ error: "position must be a finite integer" }, { status: 400 });
  }
  if (categoryId !== undefined && categoryId !== null && !isStringWithin(categoryId, MAX_TITLE_LEN)) {
    return NextResponse.json({ error: "categoryId must be string or null" }, { status: 400 });
  }
  if (isUncertain !== undefined && typeof isUncertain !== "boolean") {
    return NextResponse.json({ error: "isUncertain must be boolean" }, { status: 400 });
  }
  let parsedFallbacks: PlanFallback[] | undefined;
  if (fallbacks !== undefined && fallbacks !== null) {
    const parsed = parseFallbacksInput(fallbacks);
    if (typeof parsed === "string") {
      return NextResponse.json({ error: parsed }, { status: 400 });
    }
    parsedFallbacks = parsed;
  }

  const result = await createTask({
    date,
    title: title.trim(),
    notes: typeof notes === "string" ? notes : null,
    startTime: typeof startTime === "string" ? startTime : null,
    endTime: typeof endTime === "string" ? endTime : null,
    position: typeof position === "number" ? position : 0,
    categoryId: typeof categoryId === "string" ? categoryId : null,
    isUncertain: typeof isUncertain === "boolean" ? isUncertain : false,
    fallbacks: parsedFallbacks,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  return NextResponse.json(result.task);
}
