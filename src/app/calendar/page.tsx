import { redirect } from "next/navigation";
import { getSiteConfig, resolveTimezone } from "@/lib/site-config";
import { todayInTz } from "@/components/calendar/date-utils";

export const dynamic = "force-dynamic";

export default async function CalendarIndex() {
  const config = await getSiteConfig();
  redirect(`/calendar/day/${todayInTz(resolveTimezone(config))}`);
}
