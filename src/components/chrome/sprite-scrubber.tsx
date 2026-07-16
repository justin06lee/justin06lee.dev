"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { relXToFrame, seedEdge, stepEdge, type Edge } from "./scrub";

export interface SpriteScrubberProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange" | "onLoad"> {
  /** URL (or data URI) of the sprite sheet grid. */
  src: string;
  /** Total number of frames in the sheet. */
  frames: number;
  /** Number of columns in the sprite grid. */
  cols: number;
  /** Number of rows in the sprite grid. */
  rows: number;
  /** Left edge zone as a fraction in [0,1]. Bounds onEdge sweep detection only — frames always map across the full width. */
  edgeLeft?: number;
  /** Right edge zone as a fraction in [0,1]. Bounds onEdge sweep detection only — frames always map across the full width. */
  edgeRight?: number;
  /** Reverse the mapping so moving left plays forward (matches the original). */
  reverse?: boolean;
  /** CSS aspect-ratio for the root (e.g. "1 / 1"). */
  aspectRatio?: string;
  /** Interaction mode. Only "pointer" is supported for now. */
  mode?: "pointer";
  /** Fired when the displayed frame changes. */
  onFrameChange?: (frame: number) => void;
  /** Fired when the pointer reaches one edge zone after last visiting the opposite one — once per full sweep. */
  onEdge?: (edge: Edge) => void;
  /** Fired once the sprite sheet image has loaded. */
  onLoad?: () => void;
  /** Custom node rendered over the sprite while the sheet loads. Defaults to a minimal "loading..." overlay; return null to disable. */
  renderLoading?: () => React.ReactNode;
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
  onEdge,
  onLoad,
  renderLoading,
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
  const lastEdgeRef = React.useRef<Edge | null>(null);
  const onFrameChangeRef = React.useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;
  const onEdgeRef = React.useRef(onEdge);
  onEdgeRef.current = onEdge;
  const onLoadRef = React.useRef(onLoad);
  onLoadRef.current = onLoad;

  const [loaded, setLoaded] = React.useState(false);

  // Preload the sheet so the loading overlay clears once it can paint. A
  // failed load also clears it — the bordered black box stays as fallback.
  React.useEffect(() => {
    setLoaded(false);
    let done = false;
    const settle = (ok: boolean) => {
      if (done) return;
      done = true;
      setLoaded(true);
      if (ok) onLoadRef.current?.();
    };
    const img = new Image();
    img.onload = () => settle(true);
    img.onerror = () => settle(false);
    img.src = src;
    // Cached and data-URI images can be complete synchronously.
    if (img.complete && img.naturalWidth > 0) settle(true);
    return () => {
      done = true;
    };
  }, [src]);

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
      scheduleFrame(relXToFrame(relX, frames, reverse));
      const { last, swept } = stepEdge(lastEdgeRef.current, relX, edgeLeft, edgeRight);
      lastEdgeRef.current = last;
      if (swept) onEdgeRef.current?.(swept);
    },
    [measureRect, scheduleFrame, frames, reverse, edgeLeft, edgeRight],
  );

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== "pointer") return;
    if (e.pointerType !== "mouse" && e.buttons === 0) return;
    updateFromClientX(e.clientX);
  };

  const handleEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== "pointer") return;
    const rect = measureRect();
    // Seed the edge tracker by which half the pointer entered on, so a sweep
    // completed outside the container never fires onEdge on re-entry.
    if (rect && rect.width > 0) {
      lastEdgeRef.current = seedEdge((e.clientX - rect.left) / rect.width);
    }
    updateFromClientX(e.clientX);
  };

  const handleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== "pointer") return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    handleEnter(e);
  };

  const handleUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    // Touch drags start fresh — the next drag's first edge visit only arms
    // the tracker (no onEdge until a full sweep within that drag).
    if (e.pointerType !== "mouse") lastEdgeRef.current = null;
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
      {!loaded &&
        (renderLoading ? (
          renderLoading()
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-white/60">
            loading...
          </div>
        ))}
    </div>
  );
}
