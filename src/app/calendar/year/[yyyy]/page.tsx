import { notFound } from "next/navigation";
import YearView from "@/components/calendar/YearView";
import { getHeatmapForYear } from "@/lib/calendar";
import { isValidYearString, todayInTz } from "@/components/calendar/date-utils";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function YearPage({ params }: { params: Promise<{ yyyy: string }> }) {
  const { yyyy } = await params;
  if (!isValidYearString(yyyy)) notFound();
  const year = Number(yyyy);
  const [heatmap, config] = await Promise.all([getHeatmapForYear(year), getSiteConfig()]);
  const today = todayInTz(config.prayerLocation.timezone || "America/New_York");
  return <YearView year={year} heatmap={heatmap} today={today} />;
}
