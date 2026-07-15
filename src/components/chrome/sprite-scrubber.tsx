"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SpriteScrubberProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** URL (or data URI) of the sprite sheet grid. */
  src: string;
  /** Total number of frames in the sheet. */
  frames: number;
  /** Number of columns in the sprite grid. */
  cols: number;
  /** Number of rows in the sprite grid. */
  rows: number;
  /** Left dead zone as a fraction in [0,1]. Pointer X at/under this maps to the first scrubbed frame. */
  edgeLeft?: number;
  /** Right dead zone as a fraction in [0,1]. Pointer X at/over this maps to the last scrubbed frame. */
  edgeRight?: number;
  /** Reverse the mapping so moving left plays forward (matches the original). */
  reverse?: boolean;
  /** CSS aspect-ratio for the root (e.g. "1 / 1"). */
  aspectRatio?: string;
  /** Interaction mode. Only "pointer" is supported for now. */
  mode?: "pointer";
  /** Fired when the displayed frame changes. */
  onFrameChange?: (frame: number) => void;
}

export function SpriteScrubber({
  src,
  frames,
  cols,
  rows,
  edgeLeft = 0.22,
  edgeRight = 0.78,
  reverse = true,
  aspectRatio,
  mode = "pointer",
  className,
  style,
  onFrameChange,
  ...rest
}: SpriteScrubberProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const spriteRef = React.useRef<HTMLDivElement>(null);
  const rafRef = React.useRef<number | null>(null);
  // Container rect for the current pointer session — measured once on
  // enter/down instead of on every pointermove (layout read per move).
  const rectRef = React.useRef<DOMRect | null>(null);
  const pendingFrameRef = React.useRef<number | null>(null);
  const currentFrameRef = React.useRef(-1);
  const onFrameChangeRef = React.useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;

  // Map a relative X position (0 = left, 1 = right) to a frame index.
  const relXToFrame = React.useCallback(
    (relX: number) => {
      const span = edgeRight - edgeLeft;
      const clamped =
        span <= 0
          ? 0
          : Math.min(1, Math.max(0, (relX - edgeLeft) / span));
      const t = reverse ? 1 - clamped : clamped;
      return Math.round(t * (frames - 1));
    },
    [edgeLeft, edgeRight, reverse, frames],
  );

  const applyFrame = React.useCallback(() => {
    rafRef.current = null;
    const idx = pendingFrameRef.current;
    const el = spriteRef.current;
    if (idx === null || !el) return;
    if (idx === currentFrameRef.current) return;
    currentFrameRef.current = idx;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = cols > 1 ? (col / (cols - 1)) * 100 : 0;
    const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;
    el.style.backgroundPosition = `${x}% ${y}%`;
    onFrameChangeRef.current?.(idx);
  }, [cols, rows]);

  const scheduleFrame = React.useCallback(
    (idx: number) => {
      pendingFrameRef.current = idx;
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(applyFrame);
      }
    },
    [applyFrame],
  );

  React.useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const measureRect = React.useCallback(() => {
    const c = containerRef.current;
    rectRef.current = c ? c.getBoundingClientRect() : null;
    return rectRef.current;
  }, []);

  const updateFromClientX = React.useCallback(
    (clientX: number) => {
      const rect = rectRef.current ?? measureRect();
      if (!rect || rect.width <= 0) return;
      const relX = (clientX - rect.left) / rect.width;
      scheduleFrame(relXToFrame(relX));
    },
    [measureRect, relXToFrame, scheduleFrame],
  );

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== "pointer") return;
    if (e.pointerType !== "mouse" && e.buttons === 0) return;
    updateFromClientX(e.clientX);
  };

  const handleEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== "pointer") return;
    measureRect();
    updateFromClientX(e.clientX);
  };

  const handleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== "pointer") return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    measureRect();
    updateFromClientX(e.clientX);
  };

  const handleUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      ref={containerRef}
      onPointerEnter={handleEnter}
      onPointerMove={handleMove}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      className={cn(
        "relative select-none touch-none overflow-hidden",
        "cursor-grab active:cursor-grabbing",
        "bg-black border border-white/15",
        className,
      )}
      style={{ aspectRatio, ...style }}
      role="img"
      {...rest}
    >
      <div
        ref={spriteRef}
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          // Quoted url(): an unquoted CSS url token breaks on raw parentheses,
          // which SVG data URIs routinely contain (encodeURIComponent leaves
          // "(" and ")" unescaped) — the whole declaration is silently dropped.
          backgroundImage: `url("${src.replace(/"/g, '%22')}")`,
          backgroundSize: `${cols * 100}% ${rows * 100}%`,
          backgroundPosition: "0% 0%",
          backgroundRepeat: "no-repeat",
          imageRendering: "auto",
        }}
      />
    </div>
  );
}
