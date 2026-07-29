import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getRunningActual, getRunningActuals } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  // `?all=1` returns every occupied lane as an array. The default response is
  // deliberately left as the bare primary actual (or 204) because clients that
  // predate parallel tracks parse this body directly as a CalendarActual —
  // changing the default shape would break them silently.
  if (req.nextUrl.searchParams.get("all") !== null) {
    return NextResponse.json({ running: await getRunningActuals() });
  }

  const running = await getRunningActual();
  if (!running) return new NextResponse(null, { status: 204 });
  return NextResponse.json(running);
}
