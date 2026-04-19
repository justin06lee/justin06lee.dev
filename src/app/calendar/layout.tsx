import Navbar from "@/components/Navbar";
import CalendarShell from "@/components/calendar/CalendarShell";
import { getSiteConfig, resolveTimezone } from "@/lib/site-config";
import { todayInTz } from "@/components/calendar/date-utils";

export const dynamic = "force-dynamic";

export default async function CalendarLayout({ children }: { children: React.ReactNode }) {
  const config = await getSiteConfig();
  const today = todayInTz(resolveTimezone(config));
  const [y, m] = today.split("-");
  return (
    <>
      <Navbar />
      <CalendarShell today={today} todayMonth={`${y}-${m}`} todayYear={y}>
        {children}
      </CalendarShell>
    </>
  );
}
