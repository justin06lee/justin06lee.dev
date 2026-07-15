"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CountUpProps extends React.HTMLAttributes<HTMLElement> {
  /** target number to animate toward. */
  value: number;
  /** tween length in seconds. default 1. */
  duration?: number;
  /** fixed decimal places. default 0. ignored when `format` is set. */
  decimals?: number;
  /** custom formatter; overrides `decimals`. */
  format?: (n: number) => string;
  /** text rendered before the number. */
  prefix?: string;
  /** text rendered after the number. */
  suffix?: string;
  /** element/tag to render as. default "span". */
  as?: React.ElementType;
}

// easeOutCubic — fast start, gentle settle.
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * Animated number that counts up to `value`. The first tween (from 0) is held
 * until the element enters the viewport, so instances further down the page
 * still animate when scrolled to; later `value` changes tween immediately.
 */
export function CountUp({
  value,
  duration = 1,
  decimals = 0,
  format,
  prefix,
  suffix,
  as: Tag = "span",
  className,
  ...rest
}: CountUpProps) {
  const [display, setDisplay] = React.useState(0);
  // track the value currently shown so each tween starts where the last ended.
  const displayRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);
  const elRef = React.useRef<Element | null>(null);
  // gate the first tween on visibility; once started, value changes animate
  // immediately (each distinct value tweens exactly once, via the effect deps).
  const [started, setStarted] = React.useState(false);

  React.useEffect(() => {
    if (started) return;
    const el = elRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setStarted(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setStarted(true);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [started]);

  React.useEffect(() => {
    if (!started) return;
    const from = displayRef.current;
    const to = value;
    if (from === to) return;

    if (duration <= 0 || prefersReducedMotion()) {
      displayRef.current = to;
      setDisplay(to);
      return;
    }

    const durationMs = duration * 1000;
    let start: number | null = null;

    const tick = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const current = from + (to - from) * easeOut(t);
      displayRef.current = current;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        displayRef.current = to;
        setDisplay(to);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [value, duration, started]);

  const text = format ? format(display) : display.toFixed(decimals);

  return (
    <Tag ref={elRef} className={cn("tabular-nums", className)} {...rest}>
      {prefix}
      {text}
      {suffix}
    </Tag>
  );
}
