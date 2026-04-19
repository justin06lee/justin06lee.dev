import { NextRequest, NextResponse } from "next/server";
import { getPrayerTimesForDate } from "@/lib/prayer-times";
import { isValidDateString } from "@/components/calendar/date-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !isValidDateString(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  const times = await getPrayerTimesForDate(date);
  if (!times) return NextResponse.json(null);
  return NextResponse.json(times);
}
