import { notFound } from "next/navigation";
import DayView from "@/components/calendar/DayView";
import { loadDayPageData } from "@/lib/calendar";
import { getPrayerTimesForDate } from "@/lib/prayer-times";
import { addDays, isValidDateString, todayInTz } from "@/components/calendar/date-utils";
import { isAdminServer } from "@/lib/auth-server";
import { getSiteConfig, resolveTimezone } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidDateString(date)) notFound();
  // Fetch yesterday's anchored actuals too so a block that started yesterday
  // and crosses midnight into `date` is included; clampActualToDay filters.
  const yesterday = addDays(date, -1);
  const [day, prayers, admin, config] = await Promise.all([
    loadDayPageData(date, yesterday),
    getPrayerTimesForDate(date),
    isAdminServer(),
    getSiteConfig(),
  ]);
  const tz = resolveTimezone(config);
  return (
    <DayView
      date={date}
      tasks={day.tasks}
      actuals={day.actuals}
      runningActual={day.running}
      categories={day.categories}
      prayers={prayers}
      isAdmin={admin}
      today={todayInTz(tz)}
      timezone={tz}
    />
  );
}
