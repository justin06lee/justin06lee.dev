import type { CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PanelFrame } from "@/lib/manga-layout";

export type MangaPiece = {
  id: string;
  title: string;
  href?: string;
  src: string | null;
  width: number;
  height: number;
};

export type MangaPagesProps = {
  pages: PanelFrame<MangaPiece>[];
  /** Seam between panels inside a page, in px. Must match the packer's gap. */
  gap?: number;
  /** Black page-turn gutter between one page and the next, in px. */
  pageGap?: number;
  /**
   * Hang the pages as a horizontal band at this height instead of stacking
   * them down the screen. Any CSS length — the value goes into a `calc()`, so
   * `min(78svh, 780px)` is as valid as `720px` and the band stays responsive
   * with no measurement.
   */
  pageHeight?: string;
  className?: string;
  ariaLabel?: string;
};

/**
 * Renders solved manga pages.
 *
 * The packer emits each node's width as an exact affine function of its
 * parent's — `calc(P% + Qpx)` — so the entire nested layout is reproduced by
 * the browser with no measurement and no client JS. Rows are flex rows whose
 * children carry those widths; stacks are flex columns whose children simply
 * span them. A panel then only needs `aspect-ratio`, and its height follows.
 *
 * The consequence that matters: a panel's box is always exactly its image's
 * aspect ratio, so the art is never cropped and never letterboxed.
 *
 * The wall grows with every project, so the gallery never lets it run down the
 * page: `pageHeight` hangs it as a band instead, every page the same height and
 * drifting sideways, so the hangs below it stay one screen away however many
 * projects there are.
 */
export function MangaPages({
  pages,
  gap = 8,
  pageGap = 48,
  pageHeight,
  className,
  ariaLabel,
}: MangaPagesProps) {
  const strip = pageHeight !== undefined;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex", strip ? "items-start" : "w-full flex-col", className)}
      style={{ gap: pageGap }}
    >
      {pages.map((page, index) => (
        <div
          key={index}
          style={
            strip
              ? { width: pageWidthCss(page, pageHeight!), height: pageHeight, flex: "none" }
              : { width: frameWidthCss(page), marginInline: "auto" }
          }
        >
          <Node frame={page} width="100%" gap={gap} />
        </div>
      ))}
    </div>
  );
}

/**
 * A page's width at a given height, as CSS: `w = m·h + c`, the same affine
 * relation the rest of the layout runs on, only solved from the other end.
 *
 * `height` stays a CSS length rather than a number so the band can be sized in
 * viewport units — the browser evaluates the multiply, and the pages resize
 * with the window without a measurement or a re-solve. `m` is a bare number, so
 * `calc(1.62 * min(78svh, 780px) + 8px)` is exactly what it looks like.
 */
export function pageWidthCss(frame: PanelFrame<MangaPiece>, height: string): string {
  const m = round(frame.m, 6);
  const c = round(frame.c, 3);
  if (c === 0) return `calc(${m} * ${height})`;
  const sign = c < 0 ? "-" : "+";
  return `calc(${m} * ${height} ${sign} ${Math.abs(c)}px)`;
}

/**
 * `calc(P% + Qpx)`, collapsed to the simple forms where the terms vanish. This
 * string is the only thing the browser is told about a node's size, so it is
 * exported and round-tripped in the tests: if the rounding here drifts from the
 * solve, panels stop meeting and the page tears.
 */
export function frameWidthCss(frame: PanelFrame<MangaPiece>): string {
  const percent = round(frame.percent, 4);
  const offset = round(frame.offset, 3);
  if (offset === 0) return `${percent}%`;
  const sign = offset < 0 ? "-" : "+";
  return `calc(${percent}% ${sign} ${Math.abs(offset)}px)`;
}

const round = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

function Node({
  frame,
  width,
  gap,
}: {
  frame: PanelFrame<MangaPiece>;
  width: string;
  gap: number;
}) {
  if (frame.kind === "panel") return <Panel frame={frame} width={width} />;

  const isRow = frame.kind === "row";
  const style: CSSProperties = {
    width,
    display: "flex",
    flexDirection: isRow ? "row" : "column",
    // Not `stretch`: the solved heights already agree, and if floating point
    // ever leaves them a hair apart, a hairline of black is the right failure —
    // stretching would override `aspect-ratio` and crop the art instead.
    alignItems: isRow ? "flex-start" : "stretch",
    gap,
    // A flex item's automatic minimum size is its content's, which would let a
    // wide image refuse to fit its solved slot. These widths are exact; nothing
    // may negotiate them.
    flex: "none",
    minWidth: 0,
    minHeight: 0,
  };

  return (
    <div style={style}>
      {frame.children.map((child, index) => (
        <Node key={index} frame={child} width={frameWidthCss(child)} gap={gap} />
      ))}
    </div>
  );
}

function Panel({
  frame,
  width,
}: {
  frame: Extract<PanelFrame<MangaPiece>, { kind: "panel" }>;
  width: string;
}) {
  const { item, aspect } = frame;

  const inner = (
    <>
      {item.src ? (
        // `contain`, not `cover`. The box is already this image's exact aspect,
        // so the two are equivalent when the measured dimensions are right —
        // but when they are stale or unreadable, contain shows a sliver of
        // black and cover silently eats the art. Only one of those is
        // recoverable, and the panels are the whole point of the page.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.src}
          alt={item.title}
          loading="lazy"
          draggable={false}
          className="block h-full w-full object-contain"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center px-3 text-center text-xs lowercase tracking-wide text-white/40">
          {item.title}
        </span>
      )}
      {/* The panel's name, and — where a thumb is reading — a chip saying the
          panel opens something. A pointer gets this on hover and works the
          rest out from the cursor; a touch screen has neither, so below the
          hover breakpoint the bar is simply always on and carries the chip.
          The media query is the exact complement of the set's TOUCH_QUERY, so
          this page's two touch affordances appear and disappear together —
          and it tests `hover`, not width alone, because a tablet is wide and
          still has no pointer. Suppressed on a panel with no art: there the
          box is already nothing but its title. */}
      {item.src && (
        <span
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 flex items-end gap-2",
            "bg-gradient-to-t from-black/95 via-black/70 to-transparent px-2.5 pb-2 pt-8",
            "text-sm lowercase text-white transition-opacity duration-200 motion-reduce:transition-none",
            "[@media(hover:hover)_and_(min-width:768px)]:opacity-0",
            "group-hover:opacity-100 group-focus-visible:opacity-100",
          )}
        >
          {/* The chip sits *beside* the name, not pushed to the far edge: on a
              full-width panel that put it a thousand pixels from the thing it
              refers to, and it read as decoration rather than as the name's
              affordance. */}
          <span className="min-w-0 truncate">{item.title}</span>
          {item.href && (
            <span
              aria-hidden
              className={cn(
                "grid size-6 shrink-0 place-items-center border border-white/45 bg-black/50",
                "[@media(hover:hover)_and_(min-width:768px)]:hidden",
              )}
            >
              <ArrowUpRight className="size-3.5" strokeWidth={2.25} />
            </span>
          )}
        </span>
      )}
    </>
  );

  const boxClass = cn(
    "group relative block overflow-hidden border bg-white/[0.02] outline-none",
    // A brighter edge where there is no cursor to change on the way in: the
    // box has to read as something you press, not a picture that happens to
    // be framed. A pointer gets the quiet 12% back, and the hover to go with it.
    "border-white/30 [@media(hover:hover)_and_(min-width:768px)]:border-white/12",
    "transition-colors duration-200 hover:border-white/40 focus-visible:border-white/60",
    "motion-reduce:transition-none",
  );
  const style: CSSProperties = {
    width,
    aspectRatio: `${aspect}`,
    flex: "none",
    minWidth: 0,
    minHeight: 0,
  };

  if (!item.href) {
    return (
      <div className={boxClass} style={style} aria-label={item.title}>
        {inner}
      </div>
    );
  }

  return (
    <a
      href={item.href}
      aria-label={item.title}
      className={boxClass}
      style={style}
      target="_blank"
      rel="noopener noreferrer"
    >
      {inner}
    </a>
  );
}
