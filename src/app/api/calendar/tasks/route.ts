import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sanitizeHtml } from "@/lib/sanitize";
import { createTask, getTasksInRange } from "@/lib/calendar";
import { isValidDateString, isValidHhmm } from "@/components/calendar/date-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to || !isValidDateString(from) || !isValidDateString(to)) {
    return NextResponse.json({ error: "from and to must be YYYY-MM-DD" }, { status: 400 });
  }
  const tasks = await getTasksInRange(from, to);
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { date, title, notes, startTime, endTime, position } = body;
  if (typeof date !== "string" || !isValidDateString(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (startTime !== undefined && startTime !== null && (typeof startTime !== "string" || !isValidHhmm(startTime))) {
    return NextResponse.json({ error: "startTime must be HH:MM" }, { status: 400 });
  }
  if (endTime !== undefined && endTime !== null && (typeof endTime !== "string" || !isValidHhmm(endTime))) {
    return NextResponse.json({ error: "endTime must be HH:MM" }, { status: 400 });
  }

  const task = await createTask({
    date,
    title: sanitizeHtml(title),
    notes: typeof notes === "string" ? sanitizeHtml(notes) : null,
    startTime: typeof startTime === "string" ? startTime : null,
    endTime: typeof endTime === "string" ? endTime : null,
    position: typeof position === "number" ? position : 0,
  });
  return NextResponse.json(task);
}
