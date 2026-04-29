import { notFound } from "next/navigation";
import YearView from "@/components/calendar/YearView";
import { getOverlapHeatmapForRange } from "@/lib/calendar";
import { isValidYearString, todayInTz } from "@/lib/calendar-dates";
import { getSiteConfig, resolveTimezone } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function YearPage({ params }: { params: Promise<{ yyyy: string }> }) {
  const { yyyy } = await params;
  if (!isValidYearString(yyyy)) notFound();
  const year = Number(yyyy);
  const config = await getSiteConfig();
  const tz = resolveTimezone(config);
  const heatmap = await getOverlapHeatmapForRange(`${year}-01-01`, `${year}-12-31`, tz);
  return <YearView year={year} heatmap={heatmap} today={todayInTz(tz)} />;
}
