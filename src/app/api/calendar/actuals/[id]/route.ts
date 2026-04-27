import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateActual, deleteActual, type ActualPatch } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: ActualPatch = {};

  if (body.categoryId !== undefined) {
    if (body.categoryId !== null && typeof body.categoryId !== "string") {
      return NextResponse.json({ error: "categoryId must be string or null" }, { status: 400 });
    }
    patch.categoryId = body.categoryId as string | null;
  }
  if (body.title !== undefined) {
    if (body.title !== null && typeof body.title !== "string") {
      return NextResponse.json({ error: "title must be string or null" }, { status: 400 });
    }
    patch.title = body.title as string | null;
  }
  if (body.startAt !== undefined) {
    if (typeof body.startAt !== "number" || body.startAt <= 0) {
      return NextResponse.json({ error: "startAt must be a positive epoch ms" }, { status: 400 });
    }
    patch.startAt = body.startAt;
  }
  if (body.endAt !== undefined) {
    if (body.endAt !== null && (typeof body.endAt !== "number" || body.endAt <= 0)) {
      return NextResponse.json({ error: "endAt must be epoch ms or null" }, { status: 400 });
    }
    patch.endAt = body.endAt as number | null;
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== "string") {
      return NextResponse.json({ error: "notes must be string or null" }, { status: 400 });
    }
    patch.notes = body.notes as string | null;
  }

  const result = await updateActual(id, patch);
  if (!result.ok) {
    if (result.reason === "not-found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (result.reason === "start-after-end") {
      return NextResponse.json({ error: "startAt must be before endAt" }, { status: 400 });
    }
    if (result.reason === "would-overlap-running") {
      return NextResponse.json({ error: "Edit would overlap the running actual" }, { status: 409 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
  return NextResponse.json(result.actual);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { id } = await params;
  const result = await deleteActual(id);
  if (!result.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
