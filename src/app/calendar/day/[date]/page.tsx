import { notFound } from "next/navigation";
import DayView from "@/components/calendar/DayView";
import {
  getTasksInRange,
  getActualsInRange,
  getRunningActual,
} from "@/lib/calendar";
import { listCategories } from "@/lib/calendar-categories";
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
  const [tasks, actuals, running, categories, prayers, admin, config] = await Promise.all([
    getTasksInRange(date, date),
    getActualsInRange(yesterday, date),
    getRunningActual(),
    listCategories(),
    getPrayerTimesForDate(date),
    isAdminServer(),
    getSiteConfig(),
  ]);
  const tz = resolveTimezone(config);
  return (
    <DayView
      date={date}
      tasks={tasks}
      actuals={actuals}
      runningActual={running}
      categories={categories}
      prayers={prayers}
      isAdmin={admin}
      today={todayInTz(tz)}
      timezone={tz}
    />
  );
}
