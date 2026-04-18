import { notFound } from "next/navigation";
import YearView from "@/components/calendar/YearView";
import { getHeatmapForYear } from "@/lib/calendar";
import { isValidYearString } from "@/components/calendar/date-utils";

export const dynamic = "force-dynamic";

export default async function YearPage({ params }: { params: Promise<{ yyyy: string }> }) {
  const { yyyy } = await params;
  if (!isValidYearString(yyyy)) notFound();
  const year = Number(yyyy);
  const heatmap = await getHeatmapForYear(year);
  return <YearView year={year} heatmap={heatmap} />;
}
