import { notFound } from "next/navigation";
import { Suspense } from "react";
import DayView from "@/components/calendar/DayView";
import PrayerMarkers from "@/components/calendar/PrayerMarkers";
import { loadDayPageData } from "@/lib/calendar";
import { addDays, isValidDateString, todayInTz } from "@/lib/calendar-dates";
import { isAdminServer } from "@/lib/auth-server";
import { getSiteConfig, resolveTimezone } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidDateString(date)) notFound();
  // Fetch yesterday's anchored actuals too so a block that started yesterday
  // and crosses midnight into `date` is included; clampActualToDay filters.
  const yesterday = addDays(date, -1);
  // Prayer times intentionally excluded from this Promise.all — they stream
  // in via the Suspense'd <PrayerMarkers /> below so a slow Aladhan fetch
  // doesn't block the rest of the day view from rendering.
  const [day, admin, config] = await Promise.all([
    loadDayPageData(date, yesterday),
    isAdminServer(),
    getSiteConfig(),
  ]);
  const tz = resolveTimezone(config);
  return (
    <DayView
      date={date}
      tasks={day.tasks}
      actuals={day.actuals}
      categories={day.categories}
      prayersSlot={
        <Suspense fallback={null}>
          <PrayerMarkers date={date} />
        </Suspense>
      }
      isAdmin={admin}
      today={todayInTz(tz)}
      timezone={tz}
    />
  );
}
