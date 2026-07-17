"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Range } from "@/components/chrome/range";

export type CropValue = {
  /** Image url. */
  url: string;
  /** Zoom applied to the image inside the frame. */
  scale: number;
  /** Horizontal framing offset, in % of the frame. */
  x: number;
  /** Vertical framing offset, in % of the frame. */
  y: number;
};

export type ImageCropperProps = {
  /** Controlled crop value. */
  value: CropValue;
  /** Emitted on drag/zoom/nudge. */
  onChange: (value: CropValue) => void;
  /** Frame size in px (square unless `aspect` is set). */
  size?: number;
  /** Width / height ratio of the frame. */
  aspect?: number;
  /** Min/max zoom. */
  minScale?: number;
  maxScale?: number;
  /** Render a circular crop guide over the frame. */
  circle?: boolean;
  className?: string;
};

/**
 * Drag-to-reposition + scroll/slider-to-zoom image cropper. Dark only.
 * Drag inside the frame nudges x/y, the wheel and the sliders drive zoom.
 * Offsets and zoom are clamped so the image always covers the frame — no
 * empty space can show inside the crop. Emits `{ url, scale, x, y }` via
 * `onChange` only.
 */
export function ImageCropper({
  value,
  onChange,
  size = 240,
  aspect = 1,
  minScale = 1,
  maxScale = 4,
  circle = false,
  className,
}: ImageCropperProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    w: number;
    stop: () => void;
  } | null>(null);

  // The image is rendered frame-sized with `object-cover`, so at scale 1 it
  // exactly covers the frame; below 1 it would be smaller than the frame on
  // both axes. Floor the zoom there regardless of the `minScale` prop.
  const effectiveMinScale = Math.max(minScale, 1);
  const clampScale = (s: number) =>
    Math.min(maxScale, Math.max(effectiveMinScale, s));
  // Max |offset| (in % of the frame, per axis) that still keeps the scaled
  // image covering the frame: the overhang is (scale - 1) / 2 of the frame,
  // i.e. (scale - 1) * 50 in translate percent. Shrinks to 0 at scale 1.
  const maxOffset = (s: number) => Math.max(0, (s - 1) * 50);
  const clampPct = (p: number, s: number = value.scale) =>
    Math.min(maxOffset(s), Math.max(-maxOffset(s), p));
  // Zooming out shrinks the allowed offset, so re-clamp x/y with the new scale.
  const changeScale = (raw: number) => {
    const scale = clampScale(raw);
    onChange({
      ...value,
      scale,
      x: clampPct(value.x, scale),
      y: clampPct(value.y, scale),
    });
  };

  // Drag moves/ups are handled on the window (attached on pointerdown,
  // detached when the drag ends) so the drag keeps tracking while the pointer
  // is outside the frame and ends reliably wherever the button is released.
  // The listeners are long-lived within a drag, so route them through a ref
  // that is refreshed every render (same trick as the wheel handler below).
  const onDragMoveRef = useRef<(e: PointerEvent) => void>(null);
  onDragMoveRef.current = (e: PointerEvent) => {
    const d = dragState.current;
    if (!d || e.pointerId !== d.pointerId) return;
    // A pointerup we never saw (e.g. released over browser chrome) leaves the
    // mouse moving with no button held — treat that as the end of the drag.
    if (e.pointerType === "mouse" && e.buttons === 0) {
      d.stop();
      return;
    }
    const dxPct = ((e.clientX - d.startX) / d.w) * 100;
    const dyPct = ((e.clientY - d.startY) / d.w) * 100;
    onChange({
      ...value,
      x: clampPct(d.origX + dxPct),
      y: clampPct(d.origY + dyPct),
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const box = boxRef.current;
    if (!box || dragState.current) return;
    const { pointerId } = e;
    // Capture keeps other elements from reacting mid-drag where supported;
    // the window listeners below are the source of truth either way.
    try {
      box.setPointerCapture(pointerId);
    } catch {
      // inactive pointer — the window listeners still track the drag.
    }
    const onMove = (ev: PointerEvent) => onDragMoveRef.current?.(ev);
    const onEnd = (ev: PointerEvent) => {
      if (ev.pointerId === pointerId) dragState.current?.stop();
    };
    const stop = () => {
      dragState.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      if (box.hasPointerCapture(pointerId)) {
        box.releasePointerCapture(pointerId);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    dragState.current = {
      pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: value.x,
      origY: value.y,
      w: box.getBoundingClientRect().width,
      stop,
    };
  };

  // End any in-flight drag on unmount so the window listeners don't leak.
  useEffect(() => () => dragState.current?.stop(), []);

  // React registers wheel listeners as passive, so preventDefault there is a
  // no-op (the page scrolls while zooming). Attach a non-passive one instead.
  const onWheelRef = useRef<(e: WheelEvent) => void>(null);
  onWheelRef.current = (e: WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    changeScale(value.scale + delta);
  };
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onWheel = (e: WheelEvent) => onWheelRef.current?.(e);
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        className={cn(
          "relative overflow-hidden border border-white/20 bg-white/5",
          "cursor-grab touch-none select-none active:cursor-grabbing",
        )}
        style={{ width: size, height: size / aspect }}
      >
        {value.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value.url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={{
              transform: `translate(${value.x}%, ${value.y}%) scale(${value.scale})`,
              transformOrigin: "center",
            }}
          />
        )}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/30",
            circle && "rounded-full",
          )}
        />
      </div>

      <div className="flex flex-col gap-4" style={{ width: size }}>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/60">
            Zoom: {value.scale.toFixed(2)}x
          </span>
          <Range
            value={value.scale}
            onChange={changeScale}
            min={effectiveMinScale}
            max={maxScale}
            step={0.01}
            ariaLabel="zoom"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-white/60">X: {value.x.toFixed(0)}%</span>
            <Range
              value={value.x}
              onChange={(x) => onChange({ ...value, x: clampPct(x) })}
              min={-maxOffset(value.scale)}
              max={maxOffset(value.scale)}
              step={0.5}
              ariaLabel="horizontal offset"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-white/60">Y: {value.y.toFixed(0)}%</span>
            <Range
              value={value.y}
              onChange={(y) => onChange({ ...value, y: clampPct(y) })}
              min={-maxOffset(value.scale)}
              max={maxOffset(value.scale)}
              step={0.5}
              ariaLabel="vertical offset"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...value, x: 0, y: 0, scale: 1 })}
          className="self-start border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10"
        >
          Reset position & zoom
        </button>
      </div>
    </div>
  );
}
