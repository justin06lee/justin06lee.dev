"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type PfpProps = {
  /** Image url. */
  src: string;
  alt?: string;
  /** Horizontal framing offset, in % of the tile (passed to translate). */
  x?: number;
  /** Vertical framing offset, in % of the tile. */
  y?: number;
  /** Zoom applied to the image inside the tile. */
  scale?: number;
  /** Tilt angle on hover, in degrees. */
  rotate?: number;
  className?: string;
};

/**
 * Profile-picture tile: an image framed in a bordered square that tilts in 3d
 * on hover while a thick solid white stripe sweeps diagonally across it — a
 * cartoon-style glint. Use `x`/`y`/`scale` to frame the subject within the
 * tile. Size it via `className` (defaults to `size-16`).
 */
export function Pfp({
  src,
  alt = "",
  x = 0,
  y = 0,
  scale = 1,
  rotate = 14,
  className,
}: PfpProps) {
  const [hover, setHover] = useState(false);
  const glintRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);

  // One glint per hover: a transform-only sweep, so it stays on the
  // compositor. The stripe rests off the left edge (clipped by
  // overflow-hidden) and crosses to past the right edge.
  const sweep = () => {
    if (!glintRef.current) return;
    animRef.current?.cancel();
    animRef.current = glintRef.current.animate(
      [
        { transform: "translate3d(-300%, 0, 0)" },
        { transform: "translate3d(400%, 0, 0)" },
      ],
      { duration: 800, easing: "ease-in-out", fill: "forwards" },
    );
  };

  const leave = () => {
    setHover(false);
    animRef.current?.cancel();
  };

  return (
    <div style={{ perspective: "500px" }}>
      <div
        onMouseEnter={() => {
          setHover(true);
          sweep();
        }}
        onMouseLeave={leave}
        className={cn(
          "relative size-16 overflow-hidden border border-white/70 bg-white/5 cursor-pointer",
          className,
        )}
        style={{
          transform: hover
            ? `rotateX(${rotate}deg) rotateY(${rotate}deg) translateZ(0)`
            : "rotateX(0deg) rotateY(0deg) translateZ(0)",
          transformStyle: "preserve-3d",
          transition: "transform 0.4s cubic-bezier(0.2, 0.9, 0.2, 1)",
          willChange: "transform",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{
            transform: `translate(${x}%, ${y}%) scale(${scale})`,
            transformOrigin: "center",
          }}
        />
        {/* Thick solid white diagonal stripe — the cartoon glint. `rotate` is
            a standalone CSS property, so the WAAPI transform sweep does not
            override the slant. */}
        <div
          ref={glintRef}
          aria-hidden
          className="pointer-events-none absolute -top-1/2 -bottom-1/2 left-0 w-2/5"
          style={{
            background: "rgba(255,255,255,0.85)",
            rotate: "25deg",
            transform: "translate3d(-300%, 0, 0)",
            willChange: "transform",
          }}
        />
      </div>
    </div>
  );
}
