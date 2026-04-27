import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateCategory, deleteCategory } from "@/lib/calendar-categories";

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

  const patch: { name?: string; color?: string; archived?: boolean; position?: number } = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json({ error: "name must be non-empty" }, { status: 400 });
    }
    patch.name = body.name;
  }
  if (body.color !== undefined) {
    if (typeof body.color !== "string") {
      return NextResponse.json({ error: "color must be a string" }, { status: 400 });
    }
    patch.color = body.color;
  }
  if (body.archived !== undefined) {
    if (typeof body.archived !== "boolean") {
      return NextResponse.json({ error: "archived must be boolean" }, { status: 400 });
    }
    patch.archived = body.archived;
  }
  if (body.position !== undefined) {
    if (typeof body.position !== "number") {
      return NextResponse.json({ error: "position must be number" }, { status: 400 });
    }
    patch.position = body.position;
  }

  const result = await updateCategory(id, patch);
  if (!result.ok) {
    if (result.reason === "not-found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (result.reason === "duplicate") return NextResponse.json({ error: "Duplicate name" }, { status: 409 });
    if (result.reason === "invalid-color") return NextResponse.json({ error: "Invalid color" }, { status: 400 });
    if (result.reason === "system-name-locked") {
      return NextResponse.json({ error: "Cannot rename a system category" }, { status: 400 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
  return NextResponse.json(result.category);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const { id } = await params;
  const result = await deleteCategory(id);
  if (!result.ok) {
    if (result.reason === "not-found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (result.reason === "system-locked") {
      return NextResponse.json({ error: "Cannot delete a system category" }, { status: 400 });
    }
    if (result.reason === "in-use") {
      return NextResponse.json(
        { error: "Category is in use", planCount: result.planCount, actualCount: result.actualCount },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
