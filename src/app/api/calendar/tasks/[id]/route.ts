import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteTask, updateTask, type CalendarTaskPatch } from "@/lib/calendar";
import { isValidDateString, isValidHhmm } from "@/components/calendar/date-utils";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAdmin(req);
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
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      return NextResponse.json({ error: "title must be non-empty string" }, { status: 400 });
    }
    patch.title = body.title.trim();
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== "string") {
      return NextResponse.json({ error: "notes must be string or null" }, { status: 400 });
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
    if (typeof body.position !== "number") {
      return NextResponse.json({ error: "position must be number" }, { status: 400 });
    }
    patch.position = body.position;
  }
  if (body.date !== undefined) {
    if (typeof body.date !== "string" || !isValidDateString(body.date)) {
      return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }
    patch.date = body.date;
  }

  const task = await updateTask(id, patch);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json(task);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { id } = await params;
  await deleteTask(id);
  return NextResponse.json({ ok: true });
}
