"use client";

import { useRouter } from "next/navigation";
import * as motion from "motion/react-client";
import type { CalendarTask } from "@/lib/calendar";
import { hhmmToMinutes, overlapIntensityClass } from "@/lib/calendar-dates";
import { Calendar } from "@/components/chrome/calendar";

const fadeIn = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
};

type Props = {
  yyyymm: string;
  tasks: CalendarTask[];
  /** Plan/actual overlap minutes per day — drives cell intensity. */
  heatmap?: Record<string, number>;
  today: string;
};

export default function MonthView({ yyyymm, tasks, heatmap, today }: Props) {
  const router = useRouter();

  const byDate = new Map<string, CalendarTask[]>();
  for (const t of tasks) {
    const arr = byDate.get(t.date) ?? [];
    arr.push(t);
    byDate.set(t.date, arr);
  }
  // Sort each day's tasks once: by start time, then position, then id. Untimed
  // (or same-time) tasks tie-break on position, then id for determinism.
  for (const arr of byDate.values()) {
    arr.sort((a, b) => {
      const aMin = hhmmToMinutes(a.startTime) ?? Infinity;
      const bMin = hhmmToMinutes(b.startTime) ?? Infinity;
      if (aMin !== bMin) return aMin - bMin;
      if (a.position !== b.position) return a.position - b.position;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }

  return (
    <motion.div {...fadeIn} transition={{ duration: 0.4 }}>
      <Calendar
        className="w-full"
        // CalendarShell already renders the period nav (prev/today/next +
        // switcher) above this grid, so hide Calendar's built-in header to
        // avoid a duplicate month nav.
        showHeader={false}
        month={yyyymm}
        onMonthChange={(m) => router.push(`/calendar/month/${m}`)}
        // Month view never keeps a persisted selection — clicking a day
        // navigates straight to that day's page.
        selected={null}
        onSelect={(date) => router.push(`/calendar/day/${date}`)}
        today={today}
        // Cell sizing lives here; the per-day heatmap tint is the fill ratio
        // (how fully the day's plan was followed). The today ring and any
        // selection tint are applied by Calendar itself.
        cellClassName={(day) => {
          const overlapRatio = heatmap?.[day.date] ?? 0;
          return `min-h-28 gap-1 p-2 hover:ring-1 hover:ring-white/30 ${overlapIntensityClass(overlapRatio, "month")}`;
        }}
        renderCell={({ date, day, isToday }) => {
          // The corner ratio shows done/total tasks — a different axis from the
          // background fill ratio, both useful at a glance.
          const dayTasks = byDate.get(date) ?? [];
          const done = dayTasks.filter((t) => t.done).length;
          const total = dayTasks.length;
          const visible = dayTasks.slice(0, 3);
          const extra = total - visible.length;
          return (
            <>
              <div className="flex items-baseline justify-between">
                <span className={`font-mono text-sm tabular-nums ${isToday ? "text-white font-semibold" : "text-white/80"}`}>
                  {day}
                </span>
                {total > 0 && (
                  <span className="font-mono text-[9px] uppercase tracking-widest text-white/40 tabular-nums">
                    {done}/{total}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-[2px] mt-0.5 overflow-hidden">
                {visible.map((t) => (
                  <span
                    key={t.id}
                    className={`text-[10px] leading-tight truncate ${t.done ? "text-white/30 line-through" : "text-white/70"}`}
                    title={t.title}
                  >
                    {t.title}
                  </span>
                ))}
                {extra > 0 && (
                  <span className="text-[9px] font-mono uppercase tracking-widest text-white/40">+{extra} more</span>
                )}
              </div>
            </>
          );
        }}
      />
    </motion.div>
  );
}
