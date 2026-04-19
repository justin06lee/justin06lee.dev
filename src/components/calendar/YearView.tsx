"use client";

import Link from "next/link";
import { buildMonthGrid, WEEKDAY_LETTERS, MONTH_NAMES_SHORT } from "./date-utils";

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

function MonthGrid({ year, month, heatmap, today }: { year: number; month: number; heatmap: Record<string, number>; today: string }) {
  const mm = String(month).padStart(2, "0");
  const cells = buildMonthGrid(`${year}-${mm}`);

  return (
    <div className="flex flex-col gap-1.5">
      <Link
        href={`/calendar/month/${year}-${mm}`}
        className="font-mono text-[11px] uppercase tracking-widest text-white/70 hover:text-white transition self-start"
      >
        {MONTH_NAMES_SHORT[month - 1]}
      </Link>
      <div className="grid grid-cols-7 gap-[3px] text-[9px] font-mono text-white/30">
        {WEEKDAY_LETTERS.map((w, i) => (
          <div key={i} className="flex items-center justify-center h-3">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-[3px]">
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="aspect-square" />;
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
        {MONTH_NAMES_SHORT.map((_, idx) => (
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
