import { NextRequest, NextResponse } from "next/server";
import { requireAdminWithMutationRate } from "@/lib/auth";
import { stopActual } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authError = await requireAdminWithMutationRate(req);
  if (authError) return authError;
  const result = await stopActual();
  return NextResponse.json(result);
}
