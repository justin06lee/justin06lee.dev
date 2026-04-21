import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  updateAnnotation,
  deleteAnnotation,
  type AnnotationPatch,
} from "@/lib/annotations";

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

  const patch: AnnotationPatch = {};

  if (body.comment !== undefined) {
    if (body.comment !== null && typeof body.comment !== "string") {
      return NextResponse.json(
        { error: "comment must be string or null" },
        { status: 400 },
      );
    }
    patch.comment = body.comment as string | null;
  }

  if (body.public !== undefined) {
    if (typeof body.public !== "boolean") {
      return NextResponse.json(
        { error: "public must be boolean" },
        { status: 400 },
      );
    }
    patch.public = body.public;
  }

  if (body.highlightColor !== undefined) {
    if (body.highlightColor !== null && typeof body.highlightColor !== "string") {
      return NextResponse.json(
        { error: "highlightColor must be string or null" },
        { status: 400 },
      );
    }
    patch.highlightColor = body.highlightColor as string | null;
  }

  const annotation = await updateAnnotation(id, patch);
  if (!annotation) {
    return NextResponse.json({ error: "Annotation not found" }, { status: 404 });
  }
  return NextResponse.json(annotation);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { id } = await params;
  await deleteAnnotation(id);
  return NextResponse.json({ ok: true });
}
