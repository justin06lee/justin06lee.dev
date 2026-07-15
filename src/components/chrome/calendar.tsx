"use client";

import { cn } from "@/lib/utils";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** Sunday-aligned grid of YYYY-MM-DD strings for a "YYYY-MM" month, null = padding. */
function buildMonthGrid(yyyymm: string): (string | null)[] {
  const [y, m] = yyyymm.split("-").map(Number) as [number, number];
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(`${y}-${mm}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function shiftMonth(yyyymm: string, delta: number): string {
  const [y, m] = yyyymm.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type CalendarProps = {
  /** Displayed month, "YYYY-MM". Controlled when paired with onMonthChange. */
  month: string;
  onMonthChange?: (month: string) => void;
  /** Selected day, "YYYY-MM-DD". */
  selected?: string | null;
  onSelect?: (date: string) => void;
  /** Day to ring as "today", "YYYY-MM-DD". */
  today?: string;
  /** Render extra content under a day number (dots, counts). */
  renderDay?: (date: string) => React.ReactNode;
  className?: string;
};

/**
 * Month date grid — selectable days, today ring, prev/next header. Sunday-
 * aligned. Generalized from the justin06lee.dev calendar month view; pass
 * `renderDay` to layer task dots or counts onto cells.
 */
export function Calendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  today,
  renderDay,
  className,
}: CalendarProps) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const cells = buildMonthGrid(month);

  return (
    <div className={cn("w-fit select-none", className)}>
      <div className="mb-3 flex items-center justify-between gap-4">
        <button
          type="button"
          aria-label="previous month"
          onClick={() => onMonthChange?.(shiftMonth(month, -1))}
          className="text-white/50 transition-colors hover:text-white disabled:opacity-30"
          disabled={!onMonthChange}
        >
          ‹
        </button>
        <span className="font-mono text-sm uppercase tracking-widest text-white/70">
          {MONTH_NAMES[m - 1]} {y}
        </span>
        <button
          type="button"
          aria-label="next month"
          onClick={() => onMonthChange?.(shiftMonth(month, 1))}
          className="text-white/50 transition-colors hover:text-white disabled:opacity-30"
          disabled={!onMonthChange}
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-[3px]">
        {WEEKDAY_LETTERS.map((w, i) => (
          <div key={i} className="flex h-6 items-center justify-center font-mono text-[10px] uppercase tracking-widest text-white/40">
            {w}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="size-9" />;
          const day = Number(date.split("-")[2]);
          const isToday = date === today;
          const isSelected = date === selected;
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect?.(date)}
              aria-pressed={isSelected}
              className={cn(
                "flex size-9 flex-col items-center justify-center font-mono text-sm tabular-nums transition-colors",
                isSelected
                  ? "bg-white text-black"
                  : "text-white/80 hover:bg-white/10",
                isToday && !isSelected && "ring-1 ring-inset ring-white/80",
              )}
            >
              {day}
              {renderDay?.(date)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
