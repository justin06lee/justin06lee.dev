"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type PaneProps = {
  children: React.ReactNode;
  /**
   * Tallest the pane may grow, as any CSS length — `min(85vh, 900px)` is a
   * fine answer. Content shorter than this is left alone and the pane does
   * not scroll.
   */
  maxHeight?: string;
  /** Show a thin scrollbar. Off leaves the pane scrollable but unmarked. */
  scrollbar?: boolean;
  /** Accessible name. Given one, the pane becomes a named region. */
  ariaLabel?: string;
  className?: string;
};

/**
 * A window onto content taller than the room you want to give it: the pane
 * scrolls, not the page.
 *
 * This is what a section becomes when it would otherwise push everything below
 * it off the end of the document — a growing wall of images, a long log, a list
 * that has no natural end. `shelf` is the horizontal errand (a row of cards you
 * skim, sized by the shelf, paged by arrows); a pane keeps its content exactly
 * as given and only bounds how much of it you see at once.
 *
 * Three decisions worth knowing:
 *
 * **The scrollbar is shown by default, and the fade is what it leans on.** A
 * bounded box with no visible edge to its content reads as a broken layout
 * rather than a window. The rules are written against a class so they win over
 * an app-wide `*::-webkit-scrollbar { display: none }` — the usual way a site
 * goes scrollbar-free — which is exactly the kind of site that needs this one
 * back. Both the standard properties and the `::-webkit-scrollbar`
 * pseudo-elements are set, and **neither is redundant**: Chrome 121+ ignores
 * the pseudo-elements once `scrollbar-width` is set (and on macOS then paints
 * an overlay bar, visible while scrolling), while Safari and older Chrome
 * ignore the standard properties and take the pseudo-elements, where the bar
 * is always visible and 6px wide. Since neither is guaranteed to be on screen
 * at rest, the edge fade below carries the affordance on its own.
 *
 * **Scroll chaining is left alone.** `overscroll-behavior: contain` looks like
 * the tidy choice and traps the reader: at the end of the pane the page must
 * keep moving, or a pane in the middle of a document becomes a wall.
 *
 * **The edge is faded only where the content actually continues**, measured
 * rather than assumed — a permanent fade at the top lies about there being
 * something above, and the same content overflows on a laptop and doesn't on a
 * tall monitor. The pane is a tab stop only while it overflows, for the same
 * reason: a focusable box that cannot scroll is a dead stop in the tab order.
 */
export function Pane({
  children,
  maxHeight = "70vh",
  scrollbar = true,
  ariaLabel,
  className,
}: PaneProps) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ start: false, end: false });

  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      const overflow = track.scrollHeight - track.clientHeight;
      // A pixel of slack: sub-pixel layout means scrollTop rarely lands
      // exactly on the maximum, and a fade that never clears looks broken.
      setEdges({
        start: track.scrollTop > 1,
        end: overflow > 1 && track.scrollTop < overflow - 1,
      });
    };

    measure();
    track.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    for (const child of Array.from(track.children)) observer.observe(child);

    return () => {
      track.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [children, maxHeight]);

  const overflowing = edges.start || edges.end;
  const fade = maskFor(edges);

  return (
    <>
      <style precedence="default" href="chrome-pane-scrollbar">{`
        .chrome-pane-bar {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.22) transparent;
        }
        .chrome-pane-bar::-webkit-scrollbar { display: block; width: 6px; }
        .chrome-pane-bar::-webkit-scrollbar-track { background: transparent; }
        .chrome-pane-bar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); }
        .chrome-pane-bar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.34); }
      `}</style>

      <div
        ref={trackRef}
        role={ariaLabel ? "region" : undefined}
        aria-label={ariaLabel}
        tabIndex={overflowing ? 0 : undefined}
        className={cn(
          "w-full overflow-y-auto overflow-x-hidden outline-none",
          scrollbar ? "chrome-pane-bar" : "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className,
        )}
        style={{ maxHeight, maskImage: fade, WebkitMaskImage: fade }}
      >
        {children}
      </div>
    </>
  );
}

/** Fades only the edge the content runs past; `undefined` when it fits. */
function maskFor({ start, end }: { start: boolean; end: boolean }): string | undefined {
  if (start && end) {
    return "linear-gradient(to bottom, transparent, black 32px, black calc(100% - 32px), transparent)";
  }
  if (start) return "linear-gradient(to bottom, transparent, black 32px)";
  if (end) return "linear-gradient(to bottom, black calc(100% - 32px), transparent)";
  return undefined;
}
