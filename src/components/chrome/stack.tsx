"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  /** how many paper layers sit behind the front card. default 1. */
  layers?: number;
  /** CSS background applied to the root element. Transparent by default. */
  background?: string;
}

const SPRING = "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)";

/** The fan-out is a hover flourish — skip it entirely for reduced-motion users. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

export function Stack({
  children,
  className = "",
  layers = 1,
  background,
  style,
  ...rest
}: StackProps) {
  const [hover, setHover] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setHover(!prefersReducedMotion())}
      onMouseLeave={() => setHover(false)}
      className={cn("relative h-44 w-40", className)}
      style={{ ...style, background }}
      {...rest}
    >
      {Array.from({ length: layers }).map((_, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute inset-0 border border-white/15 bg-black"
          style={{
            transform: hover
              ? `rotate(${-(7 + i * 5)}deg) translate(${-(8 + i * 6)}px, ${4 + i * 2}px)`
              : `rotate(${-(2 + i * 4)}deg)`,
            transition: SPRING,
            boxShadow: "0 8px 18px rgba(0,0,0,0.45)",
            zIndex: i,
          }}
        />
      ))}
      <div
        className="absolute inset-0 border border-white/15 bg-black"
        style={{
          transform: hover ? "rotate(4deg) translate(10px, -6px)" : "rotate(1deg)",
          transition: SPRING,
          boxShadow: "0 16px 28px rgba(0,0,0,0.5)",
          zIndex: layers,
        }}
      >
        {children}
      </div>
    </div>
  );
}
