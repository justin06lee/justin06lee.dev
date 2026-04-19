"use client";

import Link from "next/link";
import type { CalendarTask } from "@/lib/calendar";

type Props = {
  yyyymm: string;
  tasks: CalendarTask[];
  today: string;
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function buildGrid(yyyymm: string): (string | null)[] {
  const [y, m] = yyyymm.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const firstDow = first.getUTCDay();
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) {
    const mm = String(m).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push(`${y}-${mm}-${dd}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function intensityClass(count: number): string {
  if (count <= 0) return "";
  if (count <= 2) return "bg-white/[0.06]";
  if (count <= 4) return "bg-white/[0.10]";
  return "bg-white/[0.14]";
}

export default function MonthView({ yyyymm, tasks, today }: Props) {
  const cells = buildGrid(yyyymm);
  const [y, m] = yyyymm.split("-").map(Number);
  const byDate = new Map<string, CalendarTask[]>();
  for (const t of tasks) {
    const arr = byDate.get(t.date) ?? [];
    arr.push(t);
    byDate.set(t.date, arr);
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-mono text-sm uppercase tracking-widest text-white/70">
        {MONTH_NAMES[m - 1]} {y}
      </h2>
      <div className="grid grid-cols-7 gap-[3px] text-[10px] font-mono uppercase tracking-widest text-white/40">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="px-2 py-1">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-[3px]">
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="min-h-28" />;
          const dayTasks = byDate.get(date) ?? [];
          const done = dayTasks.filter((t) => t.done).length;
          const total = dayTasks.length;
          const day = Number(date.split("-")[2]);
          const isToday = date === today;
          const visible = dayTasks.slice(0, 3);
          const extra = dayTasks.length - visible.length;
          return (
            <Link
              key={date}
              href={`/calendar/day/${date}`}
              className={`min-h-28 p-2 flex flex-col gap-1 transition hover:ring-1 hover:ring-white/30 ${intensityClass(done)} ${isToday ? "ring-1 ring-inset ring-white/80" : ""}`}
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
      </div>
    </div>
  );
}
