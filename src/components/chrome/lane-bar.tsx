"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type Lane = {
  id: string;
  /** Name of the activity running in this lane. */
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** When set, this lane shows a live elapsed timer. Omit for a queued/idle lane. */
  startedAt?: number | Date;
  /** Optional CSS color for a small dot before the title. */
  accent?: string;
  /** Right-side slot for this lane (e.g. a Stop button). */
  actions?: React.ReactNode;
};

export type LaneBarProps = {
  /** Activities running in parallel, top to bottom. */
  lanes: Lane[];
  onLaneClick?: (id: string) => void;
  /** Right-side slot on the header row, applying to every lane. */
  actions?: React.ReactNode;
  /** Mono label on the header row. Defaults to "lanes". */
  label?: React.ReactNode;
  /** Copy shown when `lanes` is empty. Defaults to "nothing running". */
  emptyLabel?: React.ReactNode;
  /** Hide the bar (also tears down the timer). Defaults to true. */
  visible?: boolean;
  /** Pin to the viewport ("fixed", default) or the scroll container ("sticky"). */
  position?: "fixed" | "sticky";
  className?: string;
};

/** Compact elapsed format, identical to now-playing-bar: `1h 2m`, `2m 3s`, `4s`. */
function formatElapsed(startAt: number, now: number): string {
  const totalSec = Math.max(0, Math.floor((now - startAt) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function toMs(value: number | Date | undefined): number | undefined {
  if (value === undefined) return undefined;
  return value instanceof Date ? value.getTime() : value;
}

/**
 * Multi-lane sibling of now-playing-bar: several activities running at once,
 * each with its own live elapsed timer and action slot. Same visual language,
 * same elapsed format — this one just stacks.
 *
 * All lanes share a single one-second interval rather than each owning one.
 * Per-lane timers would drift apart visually (their seconds would flip at
 * different moments) and cost a render per lane per tick.
 */
export function LaneBar({
  lanes,
  onLaneClick,
  actions,
  label = "lanes",
  emptyLabel = "nothing running",
  visible = true,
  position = "fixed",
  className,
}: LaneBarProps) {
  const anyRunning = lanes.some((lane) => lane.startedAt !== undefined);
  const ticking = visible && anyRunning;

  // Null until mounted — Date.now() as the initial state would differ between
  // the server render and hydration. Until the clock starts, every lane
  // renders the stable zero form.
  const [now, setNow] = useState<number | null>(null);

  // One interval for the whole bar, alive only while something is running.
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "left-0 right-0 bottom-0 z-20 border-t border-white/20 bg-black",
        position === "fixed" ? "fixed" : "sticky",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
          {label}
          {lanes.length > 0 && (
            <span className="tabular-nums"> ({lanes.length})</span>
          )}
        </span>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {lanes.length === 0 ? (
        <div className="px-3 pb-2 text-sm text-white/40">{emptyLabel}</div>
      ) : (
        <div className="divide-y divide-white/10 border-t border-white/10">
          {lanes.map((lane) => {
            const startMs = toMs(lane.startedAt);
            const elapsed =
              startMs !== undefined ? formatElapsed(startMs, now ?? startMs) : null;

            return (
              <div
                key={lane.id}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <button
                  type="button"
                  onClick={onLaneClick ? () => onLaneClick(lane.id) : undefined}
                  disabled={!onLaneClick}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-start text-left",
                    onLaneClick ? "cursor-pointer" : "cursor-default",
                  )}
                >
                  <span className="flex min-w-0 max-w-full items-center gap-2 text-sm text-white">
                    {lane.accent && (
                      <span
                        aria-hidden
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: lane.accent }}
                      />
                    )}
                    <span className="truncate">
                      {lane.title}
                      {elapsed && <span className="tabular-nums"> · {elapsed}</span>}
                    </span>
                  </span>
                  {lane.subtitle ? (
                    <span className="truncate text-xs text-white/40">{lane.subtitle}</span>
                  ) : (
                    startMs === undefined && (
                      <span className="truncate text-xs text-white/30">paused</span>
                    )
                  )}
                </button>
                {lane.actions && (
                  <div className="flex shrink-0 items-center gap-2">{lane.actions}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
