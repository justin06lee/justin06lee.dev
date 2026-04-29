import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminWithMutationRate } from "@/lib/auth";
import { listCategories, createCategory } from "@/lib/calendar-categories";
import { MAX_NAME_LEN, isStringWithin } from "@/lib/calendar-validate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const cats = await listCategories();
  return NextResponse.json(cats);
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

  const { name, color } = body;
  if (!isStringWithin(name, MAX_NAME_LEN) || name.trim().length === 0) {
    return NextResponse.json({ error: `name is required (<= ${MAX_NAME_LEN} chars)` }, { status: 400 });
  }
  if (typeof color !== "string") {
    return NextResponse.json({ error: "color is required" }, { status: 400 });
  }

  const result = await createCategory({ name, color });
  if (!result.ok) {
    if (result.reason === "duplicate") {
      return NextResponse.json({ error: "A category with that name already exists" }, { status: 409 });
    }
    if (result.reason === "empty-name") {
      return NextResponse.json({ error: "name must be non-empty" }, { status: 400 });
    }
    if (result.reason === "invalid-color") {
      return NextResponse.json({ error: "color must be from the muted palette" }, { status: 400 });
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
  return NextResponse.json(result.category);
}
