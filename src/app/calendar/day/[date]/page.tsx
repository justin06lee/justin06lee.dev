import { notFound } from "next/navigation";
import DayView from "@/components/calendar/DayView";
import { getTasksInRange } from "@/lib/calendar";
import { getPrayerTimesForDate } from "@/lib/prayer-times";
import { isValidDateString } from "@/components/calendar/date-utils";
import { isAdminServer } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidDateString(date)) notFound();
  const [tasks, prayers, admin] = await Promise.all([
    getTasksInRange(date, date),
    getPrayerTimesForDate(date),
    isAdminServer(),
  ]);
  return <DayView date={date} tasks={tasks} prayers={prayers} isAdmin={admin} />;
}
