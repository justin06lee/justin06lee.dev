import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getRunningActual } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;
  const running = await getRunningActual();
  if (!running) return new NextResponse(null, { status: 204 });
  return NextResponse.json(running);
}
