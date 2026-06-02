"use client";

import Link from "next/link";
import * as motion from "motion/react-client";
import type { CalendarTask } from "@/lib/calendar";
import { buildMonthGrid, WEEKDAY_LETTERS, MONTH_NAMES_SHORT, hhmmToMinutes, overlapIntensityClass } from "@/lib/calendar-dates";

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
  const cells = buildMonthGrid(yyyymm);
  const [y, m] = yyyymm.split("-").map(Number);
  const byDate = new Map<string, CalendarTask[]>();
  for (const t of tasks) {
    const arr = byDate.get(t.date) ?? [];
    arr.push(t);
    byDate.set(t.date, arr);
  }

  return (
    <div className="flex flex-col gap-4">
      <motion.h2
        {...fadeIn}
        transition={{ duration: 0.4 }}
        className="font-mono text-sm uppercase tracking-widest text-white/70"
      >
        {MONTH_NAMES_SHORT[m - 1]} {y}
      </motion.h2>
      <motion.div
        {...fadeIn}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="grid grid-cols-7 gap-[3px] text-[10px] font-mono uppercase tracking-widest text-white/40"
      >
        {WEEKDAY_LETTERS.map((w, i) => (
          <div key={i} className="px-2 py-1">{w}</div>
        ))}
      </motion.div>
      <motion.div
        {...fadeIn}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-7 gap-[3px]"
      >
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="min-h-28" />;
          // Two heatmap signals coexist intentionally: cell background uses
          // the fill ratio (how fully the day's plan was followed, out of
          // min(8h, planned)), and the corner ratio shows done/total tasks.
          // Different axes, both useful at a glance.
          const dayTasks = (byDate.get(date) ?? []).sort((a, b) => {
            const aMin = hhmmToMinutes(a.startTime) ?? Infinity;
            const bMin = hhmmToMinutes(b.startTime) ?? Infinity;
            if (aMin !== bMin) return aMin - bMin;
            // Tie-break for untimed (or same-time) tasks: position, then id.
            if (a.position !== b.position) return a.position - b.position;
            return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
          });
          const done = dayTasks.filter((t) => t.done).length;
          const total = dayTasks.length;
          const day = Number(date.split("-")[2]);
          const isToday = date === today;
          const visible = dayTasks.slice(0, 3);
          const extra = total - visible.length;
          const overlapRatio = heatmap?.[date] ?? 0;
          return (
            <Link
              key={date}
              href={`/calendar/day/${date}`}
              className={`min-h-28 p-2 flex flex-col gap-1 transition hover:ring-1 hover:ring-white/30 ${overlapIntensityClass(overlapRatio, "month")} ${isToday ? "ring-1 ring-inset ring-white/80" : ""}`}
            >
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
            </Link>
          );
        })}
      </motion.div>
    </div>
  );
}
