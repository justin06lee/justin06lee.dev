import { redirect } from "next/navigation";
import { getSiteConfig, resolveTimezone } from "@/lib/site-config";
import { todayInTz } from "@/lib/calendar-dates";

export const dynamic = "force-dynamic";

export default async function CalendarIndex() {
  const config = await getSiteConfig();
  redirect(`/calendar/day/${todayInTz(resolveTimezone(config))}`);
}
