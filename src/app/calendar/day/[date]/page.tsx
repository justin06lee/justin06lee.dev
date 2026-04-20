import { notFound } from "next/navigation";
import DayView from "@/components/calendar/DayView";
import { getTasksInRange } from "@/lib/calendar";
import { getPrayerTimesForDate } from "@/lib/prayer-times";
import { isValidDateString, todayInTz } from "@/components/calendar/date-utils";
import { isAdminServer } from "@/lib/auth-server";
import { getSiteConfig, resolveTimezone } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidDateString(date)) notFound();
  const [tasks, prayers, admin, config] = await Promise.all([
    getTasksInRange(date, date),
    getPrayerTimesForDate(date),
    isAdminServer(),
    getSiteConfig(),
  ]);
  return <DayView date={date} tasks={tasks} prayers={prayers} isAdmin={admin} today={todayInTz(resolveTimezone(config))} />;
}
