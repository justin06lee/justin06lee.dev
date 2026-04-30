import { NextRequest, NextResponse } from "next/server";
import { requireAdminWithMutationRate } from "@/lib/auth";
import { deleteTask, updateTask, type CalendarTaskPatch } from "@/lib/calendar";
import { isValidDateString, isValidHhmm } from "@/lib/calendar-dates";
import {
  MAX_NOTES_LEN,
  MAX_TITLE_LEN,
  isFiniteInt32,
  isStringWithin,
  parseFallbacksInput,
} from "@/lib/calendar-validate";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAdminWithMutationRate(req);
  if (authError) return authError;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: CalendarTaskPatch = {};

  if (body.title !== undefined) {
    if (!isStringWithin(body.title, MAX_TITLE_LEN) || body.title.trim().length === 0) {
      return NextResponse.json({ error: `title must be non-empty (<= ${MAX_TITLE_LEN} chars)` }, { status: 400 });
    }
    patch.title = body.title.trim();
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && !isStringWithin(body.notes, MAX_NOTES_LEN)) {
      return NextResponse.json({ error: `notes must be string (<= ${MAX_NOTES_LEN}) or null` }, { status: 400 });
    }
    patch.notes = typeof body.notes === "string" ? body.notes : null;
  }
  if (body.startTime !== undefined) {
    if (body.startTime !== null && (typeof body.startTime !== "string" || !isValidHhmm(body.startTime))) {
      return NextResponse.json({ error: "startTime must be HH:MM or null" }, { status: 400 });
    }
    patch.startTime = (body.startTime as string | null) ?? null;
  }
  if (body.endTime !== undefined) {
    if (body.endTime !== null && (typeof body.endTime !== "string" || !isValidHhmm(body.endTime))) {
      return NextResponse.json({ error: "endTime must be HH:MM or null" }, { status: 400 });
    }
    patch.endTime = (body.endTime as string | null) ?? null;
  }
  if (body.done !== undefined) {
    if (typeof body.done !== "boolean") {
      return NextResponse.json({ error: "done must be boolean" }, { status: 400 });
    }
    patch.done = body.done;
  }
  if (body.position !== undefined) {
    if (!isFiniteInt32(body.position)) {
      return NextResponse.json({ error: "position must be a finite integer" }, { status: 400 });
    }
    patch.position = body.position;
  }
  if (body.date !== undefined) {
    if (typeof body.date !== "string" || !isValidDateString(body.date)) {
      return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }
    patch.date = body.date;
  }
  if (body.categoryId !== undefined) {
    if (body.categoryId !== null && !isStringWithin(body.categoryId, MAX_TITLE_LEN)) {
      return NextResponse.json({ error: "categoryId must be string or null" }, { status: 400 });
    }
    patch.categoryId = body.categoryId as string | null;
  }
  if (body.isUncertain !== undefined) {
    if (typeof body.isUncertain !== "boolean") {
      return NextResponse.json({ error: "isUncertain must be boolean" }, { status: 400 });
    }
    patch.isUncertain = body.isUncertain;
  }
  if (body.fallbacks !== undefined) {
    if (body.fallbacks === null) {
      patch.fallbacks = [];
    } else {
      const parsed = parseFallbacksInput(body.fallbacks);
      if (typeof parsed === "string") {
        return NextResponse.json({ error: parsed }, { status: 400 });
      }
      patch.fallbacks = parsed;
    }
  }

  const result = await updateTask(id, patch);
  if (!result.ok) {
    if (result.reason === "not-found") return NextResponse.json({ error: "Task not found" }, { status: 404 });
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  return NextResponse.json(result.task);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAdminWithMutationRate(req);
  if (authError) return authError;
  const { id } = await params;
  const result = await deleteTask(id);
  if (!result.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
