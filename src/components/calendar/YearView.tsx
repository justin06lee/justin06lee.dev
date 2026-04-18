"use client";

import Link from "next/link";

type Props = {
  year: number;
  heatmap: Record<string, number>;
};

function intensityClass(count: number): string {
  if (count <= 0) return "bg-white/[0.04]";
  if (count <= 2) return "bg-white/15";
  if (count <= 4) return "bg-white/30";
  if (count <= 6) return "bg-white/55";
  return "bg-white/85";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function YearView({ year, heatmap }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {MONTHS.map((label, idx) => {
        const month = idx + 1;
        const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
        return (
          <div key={label} className="grid grid-cols-[60px_1fr] items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/50">{label}</span>
            <div className="flex gap-[3px]">
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const mm = String(month).padStart(2, "0");
                const dd = String(day).padStart(2, "0");
                const date = `${year}-${mm}-${dd}`;
                const count = heatmap[date] ?? 0;
                return (
                  <Link
                    key={date}
                    href={`/calendar/day/${date}`}
                    title={`${date} — ${count} task${count === 1 ? "" : "s"} done`}
                    className={`w-3 h-3 ${intensityClass(count)} hover:ring-1 hover:ring-white/60 transition`}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="mt-4 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-white/40">
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
