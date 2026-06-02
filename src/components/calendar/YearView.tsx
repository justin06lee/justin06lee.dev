"use client";

import Link from "next/link";
import * as motion from "motion/react-client";
import { buildMonthGrid, WEEKDAY_LETTERS, MONTH_NAMES_SHORT, overlapIntensityClass, OVERLAP_INTENSITY_CLASSES } from "@/lib/calendar-dates";

const monthFadeIn = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
};

const legendFadeIn = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay: 0.4 },
};

type Props = {
  year: number;
  heatmap: Record<string, number>;
  today: string;
};

// heatmap value is a 0..1 fill ratio (plan followed out of min(8h, planned))
function fmtFillRatio(ratio: number): string {
  return `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}% on plan`;
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
          const ratio = heatmap[date] ?? 0;
          const isToday = date === today;
          return (
            <Link
              key={i}
              href={`/calendar/day/${date}`}
              title={`${date} — ${fmtFillRatio(ratio)}${isToday ? " (today)" : ""}`}
              className={`aspect-square ${overlapIntensityClass(ratio, "year")} ${isToday ? "ring-1 ring-white" : "hover:ring-1 hover:ring-white/60"} transition`}
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
          <motion.div
            key={idx}
            {...monthFadeIn}
            transition={{ duration: 0.4, delay: idx * 0.03 }}
          >
            <MonthGrid year={year} month={idx + 1} heatmap={heatmap} today={today} />
          </motion.div>
        ))}
      </div>
      <motion.div
        {...legendFadeIn}
        className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-white/40"
      >
        <span>less</span>
        {OVERLAP_INTENSITY_CLASSES.year.map((cls, i) => (
          <span key={i} className={`w-3 h-3 ${cls}`} />
        ))}
        <span>more</span>
      </motion.div>
    </div>
  );
}
