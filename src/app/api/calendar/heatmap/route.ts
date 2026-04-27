import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getHeatmapForYear, getActualsHeatmapForYear } from "@/lib/calendar";
import { isValidYearString } from "@/components/calendar/date-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const year = req.nextUrl.searchParams.get("year");
  if (!year || !isValidYearString(year)) {
    return NextResponse.json({ error: "year must be YYYY" }, { status: 400 });
  }
  const metric = req.nextUrl.searchParams.get("metric") ?? "plans";
  if (metric !== "plans" && metric !== "actuals") {
    return NextResponse.json({ error: "metric must be plans or actuals" }, { status: 400 });
  }
  const yearNum = Number(year);
  const heatmap = metric === "plans" ? await getHeatmapForYear(yearNum) : await getActualsHeatmapForYear(yearNum);
  return NextResponse.json(heatmap);
}
