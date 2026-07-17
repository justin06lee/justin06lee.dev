"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
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

/** Context handed to renderCell / cellClassName for one day. */
export type CalendarDay = {
  /** "YYYY-MM-DD". */
  date: string;
  /** Day of month, 1–31. */
  day: number;
  isToday: boolean;
  isSelected: boolean;
};

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
  /**
   * Replace the entire cell content — day number included — for rich month
   * grids (agendas, per-day heatmaps). Drops the compact picker styling;
   * pair with cellClassName for sizing (e.g. "min-h-28 p-2"). Days stay
   * <button>s when onSelect is set; otherwise they render as plain <div>s so
   * hosts can embed their own links.
   */
  renderCell?: (day: CalendarDay) => React.ReactNode;
  /** Per-cell classes — heatmap tint, min-height. Works in both modes. */
  cellClassName?: string | ((day: CalendarDay) => string);
  /** Show the built-in prev/next month header. Set false when an external nav (e.g. calendar-nav) already pages the month. */
  showHeader?: boolean;
  /**
   * Stretch the day rows to fill the component's height, all rows equal
   * (`auto-rows-fr`). Give the root a height via className (e.g.
   * `className="h-[70vh]"`) and each week grows to fill it — for a full-page
   * agenda month grid rather than the compact picker. Best paired with
   * renderCell. Off by default (rows size to content).
   */
  fillHeight?: boolean;
  className?: string;
};

/**
 * Month date grid — selectable days, today ring, prev/next header. Sunday-
 * aligned. Generalized from the justin06lee.dev calendar month view; pass
 * `renderDay` to layer task dots or counts onto cells, or `renderCell` +
 * `cellClassName` to take over cells entirely for agenda-style month views.
 */
export function Calendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  today,
  renderDay,
  renderCell,
  cellClassName,
  showHeader = true,
  fillHeight = false,
  className,
}: CalendarProps) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const cells = buildMonthGrid(month);

  return (
    <div className={cn(fillHeight ? "flex h-full w-full flex-col" : "w-fit", "select-none", className)}>
      {showHeader && (
        <div className="mb-3 flex items-center justify-between gap-4">
          <button
            type="button"
            aria-label="previous month"
            onClick={() => onMonthChange?.(shiftMonth(month, -1))}
            className="text-white/50 transition-colors hover:text-white disabled:opacity-30"
            disabled={!onMonthChange}
          >
            <ChevronLeft className="size-4" />
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
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}

      {/* Weekday header — kept in its own fixed-height grid so it never
          stretches when fillHeight makes the day rows grow. */}
      <div className="grid grid-cols-7 gap-[3px]">
        {WEEKDAY_LETTERS.map((w, i) => (
          <div key={i} className="flex h-6 items-center justify-center font-mono text-[10px] uppercase tracking-widest text-white/40">
            {w}
          </div>
        ))}
      </div>
      <div
        className={cn(
          "mt-[3px] grid grid-cols-7 gap-[3px]",
          fillHeight && "min-h-0 flex-1 auto-rows-fr",
        )}
      >
        {cells.map((date, i) => {
          if (!date) return <div key={i} className={renderCell ? undefined : "size-9"} />;
          const day = Number(date.split("-")[2]);
          const isToday = date === today;
          const isSelected = date === selected;
          const ctx: CalendarDay = { date, day, isToday, isSelected };
          const cellCls =
            typeof cellClassName === "function" ? cellClassName(ctx) : cellClassName;

          if (renderCell) {
            // Full-cell mode: host owns the layout (day number included).
            // Today keeps its ring; selection tints instead of inverting so
            // rich content stays readable.
            const full = cn(
              "flex min-w-0 flex-col text-left transition-colors",
              isSelected && "bg-white/10",
              isToday && "ring-1 ring-inset ring-white/80",
              cellCls,
            );
            return onSelect ? (
              <button
                key={date}
                type="button"
                onClick={() => onSelect(date)}
                aria-pressed={isSelected}
                className={full}
              >
                {renderCell(ctx)}
              </button>
            ) : (
              <div key={date} className={full}>
                {renderCell(ctx)}
              </div>
            );
          }

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
                cellCls,
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
