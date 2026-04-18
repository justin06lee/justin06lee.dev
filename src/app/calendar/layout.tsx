import CalendarShell from "@/components/calendar/CalendarShell";
import { getSiteConfig } from "@/lib/site-config";
import { todayInTz } from "@/components/calendar/date-utils";

export const dynamic = "force-dynamic";

export default async function CalendarLayout({ children }: { children: React.ReactNode }) {
  const config = await getSiteConfig();
  const tz = config.prayerLocation.timezone || "America/New_York";
  const today = todayInTz(tz);
  const [y, m] = today.split("-");
  return (
    <CalendarShell today={today} todayMonth={`${y}-${m}`} todayYear={y}>
      {children}
    </CalendarShell>
  );
}
