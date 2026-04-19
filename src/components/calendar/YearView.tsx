"use client";

import Link from "next/link";

type Props = {
  year: number;
  heatmap: Record<string, number>;
  today: string;
};

function intensityClass(count: number): string {
  if (count <= 0) return "bg-white/[0.04]";
  if (count <= 2) return "bg-white/15";
  if (count <= 4) return "bg-white/30";
  if (count <= 6) return "bg-white/55";
  return "bg-white/85";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function MonthGrid({ year, month, heatmap, today }: { year: number; month: number; heatmap: Record<string, number>; today: string }) {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const mm = String(month).padStart(2, "0");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-mono text-[11px] uppercase tracking-widest text-white/70">{MONTHS[month - 1]}</div>
      <div className="grid grid-cols-7 gap-[3px] text-[9px] font-mono text-white/30">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="flex items-center justify-center h-3">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-[3px]">
        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - firstWeekday + 1;
          if (dayNum < 1 || dayNum > daysInMonth) {
            return <div key={i} className="aspect-square" />;
          }
          const dd = String(dayNum).padStart(2, "0");
          const date = `${year}-${mm}-${dd}`;
          const count = heatmap[date] ?? 0;
          const isToday = date === today;
          return (
            <Link
              key={i}
              href={`/calendar/day/${date}`}
              title={`${date} — ${count} task${count === 1 ? "" : "s"} done${isToday ? " (today)" : ""}`}
              className={`aspect-square ${intensityClass(count)} ${isToday ? "ring-1 ring-white" : "hover:ring-1 hover:ring-white/60"} transition`}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function YearView({ year, heatmap, today }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
        {MONTHS.map((_, idx) => (
          <MonthGrid key={idx} year={year} month={idx + 1} heatmap={heatmap} today={today} />
        ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-white/40">
        <span>less</span>
        <span className="w-3 h-3 bg-white/[0.04]" />
        <span className="w-3 h-3 bg-white/15" />
        <span className="w-3 h-3 bg-white/30" />
        <span className="w-3 h-3 bg-white/55" />
        <span className="w-3 h-3 bg-white/85" />
        <span>more</span>
      </div>
    </div>
  );
}
