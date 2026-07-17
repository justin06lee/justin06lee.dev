"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

export type SegmentedProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  /** Smaller, uppercase tracking variant (mode toggle). */
  size?: "default" | "compact";
  className?: string;
  ariaLabel?: string;
};

/**
 * Controlled segmented control — a row of mutually exclusive options. The
 * active segment gets a border; the rest stay muted. Generalized from the
 * justin06lee.dev "now / backfill" mode toggle.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "default",
  className,
  ariaLabel,
}: SegmentedProps<T>) {
  const pad =
    size === "compact"
      ? "px-1.5 py-0.5 text-[10px] uppercase tracking-widest"
      : "px-3 py-1.5 text-sm";

  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Roving tabindex: only the active segment is in the tab order; arrows move
  // focus and selection between segments (looping at the ends).
  const move = (dir: 1 | -1) => {
    if (options.length === 0) return;
    const current = options.findIndex((o) => o.value === value);
    const from = current === -1 ? (dir === 1 ? -1 : options.length) : current;
    const next = (from + dir + options.length) % options.length;
    const target = options[next];
    if (target) {
      onChange(target.value);
      refs.current[next]?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
    }
  };

  const hasSelection = options.some((o) => o.value === value);

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn("inline-flex items-center gap-1", className)}
    >
      {/* Roving tabindex needs one tab stop — if no option matches value, fall
          back to the first so the control stays keyboard-reachable. */}
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            aria-pressed={active}
            tabIndex={active || (!hasSelection && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              "border transition-colors",
              pad,
              active
                ? "border-white/40 text-white"
                : "border-transparent text-white/40 hover:text-white/70",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
