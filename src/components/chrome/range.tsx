"use client";

import { cn } from "@/lib/utils";

export type RangeProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

/**
 * Thin minimal slider. Styling ships in range.css (the thumb/track pseudo-
 * elements can't be done with utility classes) and the cli patches it into
 * your globals on `add`.
 */
export function Range({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  ariaLabel,
  className,
}: RangeProps) {
  return (
    <input
      type="range"
      className={cn("chrome-range", className)}
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}
