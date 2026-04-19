import { notFound } from "next/navigation";
import MonthView from "@/components/calendar/MonthView";
import { getTasksInRange } from "@/lib/calendar";
import { isValidYearMonthString, monthRange, todayInTz } from "@/components/calendar/date-utils";
import { getSiteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function MonthPage({ params }: { params: Promise<{ yyyymm: string }> }) {
  const { yyyymm } = await params;
  if (!isValidYearMonthString(yyyymm)) notFound();
  const { from, to } = monthRange(yyyymm);
  const [tasks, config] = await Promise.all([getTasksInRange(from, to), getSiteConfig()]);
  const today = todayInTz(config.prayerLocation.timezone || "America/New_York");
  return <MonthView yyyymm={yyyymm} tasks={tasks} today={today} />;
}
