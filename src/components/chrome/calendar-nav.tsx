"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/chrome/segmented";
import { Button } from "@/components/chrome/button";

export type CalendarView = "day" | "month" | "year";

export type CalendarNavProps = {
  /** The current period label, e.g. "June 2026". */
  label: ReactNode;
  /** Controlled active view. */
  view?: CalendarView;
  /** Views to offer in the switcher. Hidden when fewer than 2. */
  views?: CalendarView[];
  onViewChange?: (view: CalendarView) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onToday?: () => void;
  /** Label for the "jump to current period" button. */
  todayLabel?: ReactNode;
  className?: string;
};

/**
 * Period-navigation header that pairs with the calendar / heatmap / timeline
 * views: a day/month/year switcher on the left, prev / today / next controls
 * on the right. Fully controlled — view + navigation are props/callbacks, no
 * router coupling. Generalized from the justin06lee.dev CalendarShell.
 */
export function CalendarNav({
  label,
  view,
  views = ["day", "month", "year"],
  onViewChange,
  onPrev,
  onNext,
  onToday,
  todayLabel = "today",
  className,
}: CalendarNavProps) {
  const showSwitcher = views.length >= 2;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3 text-white",
        className,
      )}
    >
      {showSwitcher ? (
        <Segmented<CalendarView>
          value={view ?? views[0] ?? "day"}
          onChange={(v) => onViewChange?.(v)}
          options={views.map((v) => ({ value: v, label: v }))}
          ariaLabel="Calendar view"
        />
      ) : (
        <span />
      )}

      <div className="flex items-center gap-1 text-sm">
        <Button
          variant="ghost"
          size="sm"
          icon={ChevronLeft}
          label="Previous"
          onClick={onPrev}
        />
        <span className="px-1 font-mono tabular-nums text-white/80">
          {label}
        </span>
        <Button
          variant="link"
          size="sm"
          onClick={onToday}
          className="text-white/60 hover:text-white"
        >
          {todayLabel}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={ChevronRight}
          label="Next"
          onClick={onNext}
        />
      </div>
    </div>
  );
}
