"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type NowPlayingBarProps = {
  /** Title of the currently-running activity. */
  title: React.ReactNode;
  /** When set, a live elapsed timer ticks every second. Omit for the idle state. */
  startedAt?: number | Date;
  /**
   * Optional CSS color for a small dot before the running title. The source
   * bar has no accent; omit (default) for the faithful look.
   */
  accent?: string;
  subtitle?: React.ReactNode;
  /** Right-side slot (e.g. a Stop button). */
  actions?: React.ReactNode;
  onClick?: () => void;
  /** Hide the bar (also tears down the timer). Defaults to true. */
  visible?: boolean;
  /** Pin to the viewport ("fixed", default) or the scroll container ("sticky"). */
  position?: "fixed" | "sticky";
  className?: string;
};

/** Compact elapsed format, mirroring upstream: `1h 2m`, `2m 3s`, `4s`. */
function formatElapsed(startAt: number, now: number): string {
  const totalSec = Math.max(0, Math.floor((now - startAt) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Sticky bottom "now playing" bar: a running activity with a live elapsed
 * timer and a right-side action slot, matching the upstream calendar bar's
 * look. All data is driven by props/callbacks. Dark-only.
 */
export function NowPlayingBar({
  title,
  startedAt,
  accent,
  subtitle,
  actions,
  onClick,
  visible = true,
  position = "fixed",
  className,
}: NowPlayingBarProps) {
  const startMs =
    startedAt === undefined
      ? undefined
      : startedAt instanceof Date
        ? startedAt.getTime()
        : startedAt;
  const running = visible && startMs !== undefined;

  // Null until mounted — Date.now() as the initial state would differ between
  // the server render and hydration. Until the clock starts, elapsed renders
  // the stable zero form.
  const [now, setNow] = useState<number | null>(null);

  // Tick every second only while running and visible; clean up otherwise.
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!visible) return null;

  const elapsed = startMs !== undefined ? formatElapsed(startMs, now ?? startMs) : null;

  return (
    <div
      className={cn(
        "left-0 right-0 bottom-0 z-20 border-t border-white/20 bg-black",
        position === "fixed" ? "fixed" : "sticky",
        className,
      )}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={onClick}
          disabled={!onClick}
          className={cn(
            "mr-2 flex min-w-0 flex-1 flex-col items-start text-left",
            onClick ? "cursor-pointer" : "cursor-default",
          )}
        >
          <span className="text-[10px] uppercase tracking-wider text-white/50">
            Now playing
          </span>
          {startMs !== undefined ? (
            <span className="flex min-w-0 max-w-full items-center gap-2 text-sm text-white">
              {accent && (
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: accent }}
                />
              )}
              <span className="truncate">
                {title}
                {elapsed && <span className="tabular-nums"> · {elapsed}</span>}
              </span>
            </span>
          ) : (
            <span className="truncate text-sm text-white/50">
              Nothing running
            </span>
          )}
          {subtitle && (
            <span className="truncate text-xs text-white/40">{subtitle}</span>
          )}
        </button>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
