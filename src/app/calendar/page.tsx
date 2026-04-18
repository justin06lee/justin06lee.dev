import { redirect } from "next/navigation";
import { getSiteConfig } from "@/lib/site-config";
import { todayInTz } from "@/components/calendar/date-utils";

export const dynamic = "force-dynamic";

export default async function CalendarIndex() {
  const config = await getSiteConfig();
  const tz = config.prayerLocation.timezone || "America/New_York";
  const today = todayInTz(tz);
  redirect(`/calendar/day/${today}`);
}
