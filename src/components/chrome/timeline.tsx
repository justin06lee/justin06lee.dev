"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TimelineEvent = {
  /** Minutes since midnight, 0–1440. */
  startMin: number;
  endMin: number;
  label?: string;
  /** CSS color for the block's left border + tint. Defaults to white. */
  color?: string;
};

export type TimelineTrack = {
  /** Small mono uppercase heading pinned to the track's top-left corner. */
  label?: ReactNode;
  events: TimelineEvent[];
  /** Per-track click handler; overrides the top-level `onEventClick`. */
  onEventClick?: (event: TimelineEvent) => void;
};

export type TimelineProps = {
  /** Single-track events. Ignored when `tracks` is provided. */
  events?: TimelineEvent[];
  /**
   * Multi-track mode: N labeled columns rendered side by side, sharing one
   * hour axis, grid, markers and now-line (e.g. plan vs actuals).
   */
  tracks?: TimelineTrack[];
  /** Draw a live red "now" line that ticks each minute. */
  showNow?: boolean;
  /** Override the now-line position (minutes of day). Implies the line shows. */
  nowMinutes?: number;
  /**
   * Labeled horizontal marker lines (e.g. prayer times): a thin full-width
   * line at each minutes-of-day position with a small mono uppercase label at
   * the right edge. `color` tints the line.
   */
  markers?: Array<{ minutes: number; label: string; color?: string }>;
  /**
   * A React slot rendered in the marker layer (same coordinate space as
   * `markers`), so marker data can stream in — e.g. a `<Suspense>`-wrapped
   * server component that renders `TimelineMarker`s. Absolutely positioned
   * children resolve their `top` percentages against the full 24h track.
   */
  markersSlot?: ReactNode;
  /**
   * When provided, event blocks render as buttons (keyboard-accessible,
   * subtle hover ring) and call this on click. Display-only when absent.
   */
  onEventClick?: (event: TimelineEvent) => void;
  /**
   * Opt-in editing: when provided, blocks can be dragged to move and resized
   * from their bottom edge. Called once on drop with the proposed times —
   * update your data (and the `events`/`tracks` props) to commit the change.
   */
  onEventChange?: (event: TimelineEvent, next: { startMin: number; endMin: number }) => void;
  /** Snap increment (minutes) for drag-to-move/resize. Default 5. */
  snapMinutes?: number;
  className?: string;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function HourGrid() {
  return (
    <>
      {HOURS.map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0 flex items-start border-t border-white/5 pl-2"
          style={{ top: `${(h / 24) * 100}%`, height: `${100 / 24}%` }}
        >
          <span className="mt-[-6px] font-mono text-[10px] text-white/40">
            {String(h).padStart(2, "0")}:00
          </span>
        </div>
      ))}
    </>
  );
}

/**
 * Labeled marker line, styled after the upstream prayer-time markers: a thin
 * full-width rule with a mono uppercase label sitting at the right edge.
 * Exported so a host can render its own markers inside `markersSlot` (e.g.
 * streamed in from a server component behind `<Suspense>`).
 */
export function TimelineMarker({
  minutes,
  label,
  color,
}: {
  minutes: number;
  label: string;
  color?: string;
}) {
  const clamped = Math.min(1440, Math.max(0, minutes));
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 flex items-center"
      style={{ top: `${(clamped / 1440) * 100}%` }}
    >
      <div
        className={cn("h-px flex-1", color == null && "bg-white/40")}
        style={color != null ? { background: color } : undefined}
      />
      <div className="mx-2 whitespace-nowrap font-mono text-[10px] uppercase tracking-widest text-white/70">
        {label}
      </div>
    </div>
  );
}

function NowLine({ minutes }: { minutes: number }) {
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
      style={{ top: `${(minutes / 1440) * 100}%` }}
    >
      <div className="-ml-1 size-2 shrink-0 rounded-full bg-red-500" />
      <div className="h-px flex-1 bg-red-500" />
    </div>
  );
}

function fmtHHMM(min: number) {
  const m = Math.min(1440, Math.max(0, Math.round(min)));
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

type DragState = {
  trackIndex: number;
  eventIndex: number;
  mode: "move" | "resize";
  pointerId: number;
  originY: number;
  trackHeight: number;
  /** Original clamped times at drag start. */
  startMin: number;
  endMin: number;
  /** Live preview times. */
  curStart: number;
  curEnd: number;
  moved: boolean;
};

/**
 * Day schedule — a 24h vertical axis with positioned event blocks and an
 * optional live now-line. Blocks are placed by minutes-of-day. Supports one
 * track (`events`) or several labeled tracks side by side (`tracks`) sharing
 * the same axis. Generalized from the justin06lee.dev calendar day view.
 */
export function Timeline({
  events,
  tracks,
  showNow,
  nowMinutes,
  markers,
  markersSlot,
  onEventClick,
  onEventChange,
  snapMinutes = 5,
  className,
}: TimelineProps) {
  const [liveNow, setLiveNow] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  // Set when a drag actually moved, so the click that follows pointer-up
  // doesn't also fire onEventClick.
  const suppressClick = useRef(false);

  useEffect(() => {
    if (!showNow || nowMinutes != null) return;
    const tick = () => {
      const d = new Date();
      setLiveNow(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [showNow, nowMinutes]);

  // Gate the live value on showNow so toggling it off hides the line instead
  // of freezing it at its last position. An explicit nowMinutes always shows.
  const now = nowMinutes ?? (showNow ? liveNow : null);

  const resolvedTracks: TimelineTrack[] = tracks ?? [{ events: events ?? [] }];
  const snap = Math.max(1, snapMinutes);

  const beginDrag = (
    el: HTMLElement,
    pe: React.PointerEvent,
    mode: DragState["mode"],
    trackIndex: number,
    eventIndex: number,
    startMin: number,
    endMin: number,
  ) => {
    if (!onEventChange || pe.button !== 0) return;
    // The block's positioned ancestor is the track column; its height maps
    // pixels to minutes for the whole 24h day.
    const track = el.closest("[data-timeline-track]");
    if (!(track instanceof HTMLElement)) return;
    el.setPointerCapture(pe.pointerId);
    setDrag({
      trackIndex,
      eventIndex,
      mode,
      pointerId: pe.pointerId,
      originY: pe.clientY,
      trackHeight: track.getBoundingClientRect().height,
      startMin,
      endMin,
      curStart: startMin,
      curEnd: endMin,
      moved: false,
    });
  };

  const moveDrag = (pe: React.PointerEvent) => {
    if (!drag || pe.pointerId !== drag.pointerId) return;
    const rawDelta = ((pe.clientY - drag.originY) / drag.trackHeight) * 1440;
    const delta = Math.round(rawDelta / snap) * snap;
    setDrag((d) => {
      if (!d) return d;
      if (d.mode === "move") {
        const dur = d.endMin - d.startMin;
        const curStart = Math.min(1440 - dur, Math.max(0, d.startMin + delta));
        return { ...d, curStart, curEnd: curStart + dur, moved: d.moved || delta !== 0 };
      }
      const curEnd = Math.min(1440, Math.max(d.startMin + snap, d.endMin + delta));
      return { ...d, curEnd, moved: d.moved || delta !== 0 };
    });
  };

  const endDrag = (event: TimelineEvent) => {
    if (!drag) return;
    if (drag.moved) {
      // The browser fires a click right after pointer-up on the captured
      // element; swallow that one so a drag doesn't also "click" the block.
      // The timeout is a backstop for browsers that skip the click entirely.
      suppressClick.current = true;
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      onEventChange?.(event, { startMin: drag.curStart, endMin: drag.curEnd });
    }
    setDrag(null);
  };

  return (
    <div
      className={cn(
        "relative min-h-[960px] border border-white/10 bg-white/[0.02] pl-12",
        className,
      )}
    >
      <HourGrid />
      {markers?.map((m, i) => (
        <TimelineMarker key={i} minutes={m.minutes} label={m.label} color={m.color} />
      ))}
      {markersSlot}
      {now != null && <NowLine minutes={now} />}
      <div className="absolute inset-y-0 left-12 right-0 flex">
        {resolvedTracks.map((t, ti) => {
          const handleClick = t.onEventClick ?? onEventClick;
          return (
            <div
              key={ti}
              data-timeline-track
              className={cn("relative min-w-0 flex-1", ti > 0 && "border-l border-white/10")}
            >
              {t.label != null && (
                <div className="pointer-events-none absolute left-2 top-1 z-10 font-mono text-[10px] uppercase tracking-widest text-white/40">
                  {t.label}
                </div>
              )}
              {t.events.map((e, i) => {
                // Clamp into the 0–1440 axis so out-of-range (negative or
                // >24h) events stay within the visible day instead of
                // overflowing the track.
                let start = Math.min(1440, Math.max(0, e.startMin));
                let end = Math.min(1440, Math.max(start, e.endMin));
                const dragging =
                  drag != null && drag.trackIndex === ti && drag.eventIndex === i;
                if (dragging) {
                  start = drag.curStart;
                  end = drag.curEnd;
                }
                const top = (start / 1440) * 100;
                const height = (Math.max(1, end - start) / 1440) * 100;
                const color = e.color ?? "#ffffff";
                const interactive = Boolean(handleClick);
                const editable = Boolean(onEventChange);
                const Tag = interactive ? "button" : "div";
                return (
                  <Tag
                    key={i}
                    {...(interactive
                      ? {
                          type: "button" as const,
                          onClick: () => {
                            if (suppressClick.current) {
                              suppressClick.current = false;
                              return;
                            }
                            handleClick?.(e);
                          },
                          "aria-label": `${fmtHHMM(start)}–${fmtHHMM(end)}${e.label ? ` ${e.label}` : ""}`,
                        }
                      : {})}
                    {...(editable
                      ? {
                          onPointerDown: (pe: React.PointerEvent<HTMLElement>) =>
                            beginDrag(pe.currentTarget, pe, "move", ti, i, start, end),
                          onPointerMove: moveDrag,
                          onPointerUp: () => endDrag(e),
                          onPointerCancel: () => setDrag(null),
                        }
                      : {})}
                    className={cn(
                      "absolute left-0 right-1 overflow-hidden border-l-2 px-2 py-1 text-left",
                      interactive &&
                        "cursor-pointer transition hover:ring-1 hover:ring-white/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/60 motion-reduce:transition-none",
                      editable && "cursor-grab touch-none select-none",
                      dragging && "z-20 cursor-grabbing",
                    )}
                    style={{
                      top: `${top}%`,
                      height: `${height}%`,
                      borderLeftColor: color,
                      background: `color-mix(in srgb, ${color} 15%, transparent)`,
                    }}
                  >
                    {e.label && (
                      <span className="line-clamp-2 text-[11px] leading-tight text-white/80">
                        {e.label}
                      </span>
                    )}
                    {editable && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize touch-none"
                        onPointerDown={(pe) => {
                          pe.stopPropagation();
                          beginDrag(pe.currentTarget, pe, "resize", ti, i, start, end);
                        }}
                        onPointerMove={(pe) => {
                          pe.stopPropagation();
                          moveDrag(pe);
                        }}
                        onPointerUp={(pe) => {
                          // Don't let the block's own pointer-up also end
                          // (and re-commit) this drag.
                          pe.stopPropagation();
                          endDrag(e);
                        }}
                        onPointerCancel={(pe) => {
                          pe.stopPropagation();
                          setDrag(null);
                        }}
                      />
                    )}
                  </Tag>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
