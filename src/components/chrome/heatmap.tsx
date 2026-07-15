"use client";

import { cn } from "@/lib/utils";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function buildMonthGrid(year: number, month: number): (string | null)[] {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(`${year}-${mm}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Map a value to a 0..levels-1 bucket, then to a white alpha. Level 0 is faint. */
function levelAlpha(level: number, levels: number): number {
  if (level <= 0) return 0.04;
  if (levels <= 2) return 0.85;
  return 0.15 + ((level - 1) / (levels - 2)) * 0.7;
}

function bucket(value: number, max: number, levels: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(levels - 1, Math.max(1, Math.ceil((value / max) * (levels - 1))));
}

export type HeatmapProps = {
  /** Value per day, keyed by "YYYY-MM-DD". */
  values: Record<string, number>;
  year: number;
  /** Number of intensity steps (including empty). Default 5. */
  levels?: number;
  /** Cap used for bucketing; defaults to the max value present. */
  max?: number;
  today?: string;
  onSelectDay?: (date: string) => void;
  /** Tooltip text per day; defaults to "date — value". */
  title?: (date: string, value: number) => string;
  className?: string;
};

/**
 * Year activity grid — 12 mini month grids of day cells, tinted by value
 * (contribution-graph style). Generalized from the justin06lee.dev year view.
 */
export function Heatmap({
  values,
  year,
  levels = 5,
  max,
  today,
  onSelectDay,
  title,
  className,
}: HeatmapProps) {
  const ceiling = max ?? Object.values(values).reduce((m, v) => (v > m ? v : m), 1);
  const interactive = Boolean(onSelectDay);

  const cell = (date: string | null, i: number) => {
    if (!date) return <div key={i} className="aspect-square" />;
    const value = values[date] ?? 0;
    const alpha = levelAlpha(bucket(value, ceiling, levels), levels);
    const isToday = date === today;
    const tip = title ? title(date, value) : `${date} — ${value}`;
    const Tag = interactive ? "button" : "div";
    return (
      <Tag
        key={i}
        {...(interactive ? { type: "button" as const, onClick: () => onSelectDay!(date), "aria-label": tip } : {})}
        title={tip}
        style={{ backgroundColor: `rgba(255,255,255,${alpha})` }}
        className={cn(
          "aspect-square transition",
          isToday ? "ring-1 ring-white" : "hover:ring-1 hover:ring-white/60",
        )}
      />
    );
  };

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {MONTH_NAMES_SHORT.map((name, idx) => (
          <div key={idx} className="flex flex-col gap-1.5">
            <span className="self-start font-mono text-[11px] uppercase tracking-widest text-white/70">
              {name}
            </span>
            <div className="grid grid-cols-7 gap-[3px] font-mono text-[9px] text-white/30">
              {WEEKDAY_LETTERS.map((w, i) => (
                <div key={i} className="flex h-3 items-center justify-center">{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-[3px]">
              {buildMonthGrid(year, idx + 1).map(cell)}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/40">
        <span>less</span>
        {Array.from({ length: levels }, (_, l) => (
          <span
            key={l}
            className="size-3"
            style={{ backgroundColor: `rgba(255,255,255,${levelAlpha(l, levels)})` }}
          />
        ))}
        <span>more</span>
      </div>
    </div>
  );
}
