import { NextRequest, NextResponse } from "next/server";
import { requireAdminWithMutationRate } from "@/lib/auth";
import { updateActual, deleteActual, type ActualPatch } from "@/lib/calendar";
import {
  MAX_NOTES_LEN,
  MAX_TITLE_LEN,
  isFiniteEpochMs,
  isStringWithin,
} from "@/lib/calendar-validate";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdminWithMutationRate(req);
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
    if (body.categoryId !== null && (typeof body.categoryId !== "string" || !isStringWithin(body.categoryId, MAX_TITLE_LEN))) {
      return NextResponse.json({ error: "categoryId must be string or null" }, { status: 400 });
    }
    patch.categoryId = body.categoryId as string | null;
  }
  if (body.title !== undefined) {
    if (body.title !== null && !isStringWithin(body.title, MAX_TITLE_LEN)) {
      return NextResponse.json({ error: `title must be string (<= ${MAX_TITLE_LEN}) or null` }, { status: 400 });
    }
    patch.title = body.title as string | null;
  }
  if (body.startAt !== undefined) {
    if (!isFiniteEpochMs(body.startAt)) {
      return NextResponse.json({ error: "startAt must be a finite epoch ms in 2001..2100" }, { status: 400 });
    }
    patch.startAt = body.startAt;
  }
  if (body.endAt !== undefined) {
    if (body.endAt !== null && !isFiniteEpochMs(body.endAt)) {
      return NextResponse.json({ error: "endAt must be a finite epoch ms or null" }, { status: 400 });
    }
    patch.endAt = body.endAt as number | null;
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && !isStringWithin(body.notes, MAX_NOTES_LEN)) {
      return NextResponse.json({ error: `notes must be string (<= ${MAX_NOTES_LEN}) or null` }, { status: 400 });
    }
    patch.notes = body.notes as string | null;
  }

  const result = await updateActual(id, patch);
  if (!result.ok) {
    if (result.reason === "not-found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (result.reason === "would-overlap-running") {
      return NextResponse.json({ error: "Edit would overlap the running actual" }, { status: 409 });
    }
    // start-after-end / invalid-category are 400.
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  return NextResponse.json(result.actual);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdminWithMutationRate(req);
  if (authError) return authError;
  const { id } = await params;
  const result = await deleteActual(id);
  if (!result.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
