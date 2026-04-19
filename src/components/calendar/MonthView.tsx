"use client";

import Link from "next/link";
import type { CalendarTask } from "@/lib/calendar";

type Props = {
  yyyymm: string;
  tasks: CalendarTask[];
  today: string;
};

function buildGrid(yyyymm: string): (string | null)[] {
  const [y, m] = yyyymm.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const firstDow = first.getUTCDay(); // 0 = Sun
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

export default function MonthView({ yyyymm, tasks, today }: Props) {
  const cells = buildGrid(yyyymm);
  const byDate = new Map<string, { total: number; done: number }>();
  for (const t of tasks) {
    const entry = byDate.get(t.date) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (t.done) entry.done += 1;
    byDate.set(t.date, entry);
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-px bg-white/10 border border-white/10">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-black py-2 text-center font-mono text-[10px] uppercase tracking-widest text-white/50">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="bg-black/50 min-h-24" />;
          const stats = byDate.get(date);
          const day = Number(date.split("-")[2]);
          const isToday = date === today;
          return (
            <Link
              key={date}
              href={`/calendar/day/${date}`}
              className={`bg-black min-h-24 p-2 hover:bg-white/5 transition flex flex-col ${isToday ? "ring-1 ring-inset ring-white/80" : ""}`}
            >
              <span className={`font-mono text-xs ${isToday ? "text-white font-semibold" : "text-white/80"}`}>{day}</span>
              {stats && (
                <span className="mt-auto font-mono text-[10px] text-white/50">
                  {stats.done}/{stats.total}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
