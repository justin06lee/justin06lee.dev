import { notFound } from "next/navigation";
import MonthView from "@/components/calendar/MonthView";
import { getTasksInRange, getOverlapHeatmapForRange } from "@/lib/calendar";
import { isValidYearMonthString, monthRange, todayInTz } from "@/lib/calendar-dates";
import { getSiteConfig, resolveTimezone } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function MonthPage({ params }: { params: Promise<{ yyyymm: string }> }) {
  const { yyyymm } = await params;
  if (!isValidYearMonthString(yyyymm)) notFound();
  const { from, to } = monthRange(yyyymm);
  const config = await getSiteConfig();
  const tz = resolveTimezone(config);
  const [tasks, heatmap] = await Promise.all([
    getTasksInRange(from, to),
    getOverlapHeatmapForRange(from, to, tz),
  ]);
  return <MonthView yyyymm={yyyymm} tasks={tasks} heatmap={heatmap} today={todayInTz(tz)} />;
}
