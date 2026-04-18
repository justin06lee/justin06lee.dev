import { notFound } from "next/navigation";
import MonthView from "@/components/calendar/MonthView";
import { getTasksInRange } from "@/lib/calendar";
import { isValidYearMonthString, monthRange } from "@/components/calendar/date-utils";

export const dynamic = "force-dynamic";

export default async function MonthPage({ params }: { params: Promise<{ yyyymm: string }> }) {
  const { yyyymm } = await params;
  if (!isValidYearMonthString(yyyymm)) notFound();
  const { from, to } = monthRange(yyyymm);
  const tasks = await getTasksInRange(from, to);
  return <MonthView yyyymm={yyyymm} tasks={tasks} />;
}
