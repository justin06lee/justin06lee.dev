import { notFound } from "next/navigation";
import YearView from "@/components/calendar/YearView";
import { getHeatmapForYear } from "@/lib/calendar";
import { isValidYearString, todayInTz } from "@/components/calendar/date-utils";
import { getSiteConfig, resolveTimezone } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function YearPage({ params }: { params: Promise<{ yyyy: string }> }) {
  const { yyyy } = await params;
  if (!isValidYearString(yyyy)) notFound();
  const year = Number(yyyy);
  const [heatmap, config] = await Promise.all([getHeatmapForYear(year), getSiteConfig()]);
  return <YearView year={year} heatmap={heatmap} today={todayInTz(resolveTimezone(config))} />;
}
