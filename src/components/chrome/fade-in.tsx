import * as React from "react";
import { cn } from "@/lib/utils";

export interface FadeInProps extends React.HTMLAttributes<HTMLElement> {
  /** element/component to render. default "div". */
  as?: React.ElementType;
  /** delay before the animation starts, in seconds. default 0. */
  delay?: number;
  /** starting vertical offset in px (animates to 0). default -10. */
  y?: number;
  /** starting horizontal offset in px (animates to 0). default 0. */
  x?: number;
  /** animation duration in seconds. default 0.8. */
  duration?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Fade + translate a node in on mount. Pure CSS (no motion dependency):
 * a keyframe drives opacity 0 -> 1 and translate(x, y) -> 0, with the offsets
 * passed as CSS custom properties. Honors prefers-reduced-motion.
 *
 * Timing mirrors a motion/framer `initial={{opacity:0, y:-10}}` /
 * `animate={{opacity:1, y:0}}` / `transition={{duration: 0.8}}` on-mount fade:
 * motion's default tween ease is `easeInOut` === cubic-bezier(0.42, 0, 0.58, 1),
 * so the CSS keyframe uses exactly that curve and duration to match 1:1.
 *
 * The keyframes ship inline via a hoisted <style> tag (deduped by href), so
 * the component is self-contained — no css file to wire up.
 *
 * Stagger a list with the `staggerDelay` helper:
 *   items.map((item, i) => <FadeIn key={i} delay={staggerDelay(i)}>…</FadeIn>)
 */
export function FadeIn({
  as,
  delay = 0,
  y = -10,
  x = 0,
  duration = 0.8,
  className,
  style,
  children,
  ...rest
}: FadeInProps) {
  const Tag = (as ?? "div") as React.ElementType;
  return (
    <Tag
      data-fade-in=""
      className={cn("chrome-fade-in", className)}
      style={
        {
          "--fade-x": `${x}px`,
          "--fade-y": `${y}px`,
          animationDelay: `${delay}s`,
          animationDuration: `${duration}s`,
          ...style,
        } as React.CSSProperties
      }
      {...rest}
    >
      {/* Opacity 0 -> 1 and translate(--fade-x, --fade-y) -> 0. fill-mode
          "both" keeps the element hidden during a stagger delay. React hoists
          this to <head> and dedupes across instances by href. */}
      <style precedence="default" href="chrome-fade-in-keyframes">{`
        @keyframes chrome-fade-in {
          from {
            opacity: 0;
            transform: translate(var(--fade-x, 0), var(--fade-y, -10px));
          }
          to {
            opacity: 1;
            transform: translate(0, 0);
          }
        }
        .chrome-fade-in {
          animation-name: chrome-fade-in;
          /* Match motion's default on-mount tween: 0.8s, easeInOut. Inline
             style props (animation-duration/-delay) override these per instance. */
          animation-duration: 0.8s;
          animation-delay: 0s;
          animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1);
          animation-fill-mode: both;
          animation-iteration-count: 1;
        }
        @media (prefers-reduced-motion: reduce) {
          .chrome-fade-in {
            animation: none;
          }
        }
      `}</style>
      {children}
    </Tag>
  );
}

/** Stagger helper mirroring upstream: delay = base + i * step (seconds). */
export function staggerDelay(index: number, step = 0.1, base = 0): number {
  return base + index * step;
}
