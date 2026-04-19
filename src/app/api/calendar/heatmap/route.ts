import { NextRequest, NextResponse } from "next/server";
import { getHeatmapForYear } from "@/lib/calendar";
import { isValidYearString } from "@/components/calendar/date-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get("year");
  if (!year || !isValidYearString(year)) {
    return NextResponse.json({ error: "year must be YYYY" }, { status: 400 });
  }
  const heatmap = await getHeatmapForYear(Number(year));
  return NextResponse.json(heatmap);
}
