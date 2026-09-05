import type { CSSProperties } from "react";
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
 * The wall grows downward with every project, so the gallery hangs it inside
 * a `Pane` — a bounded window with its own scrollbar — rather than letting it
 * push the hangs below it off the end of the page.
 */
export function MangaPages({
  pages,
  gap = 8,
  pageGap = 48,
  className,
  ariaLabel,
}: MangaPagesProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex w-full flex-col", className)}
      style={{ gap: pageGap }}
    >
      {pages.map((page, index) => (
        <div key={index} style={{ width: frameWidthCss(page), marginInline: "auto" }}>
          <Node frame={page} width="100%" gap={gap} />
        </div>
      ))}
    </div>
  );
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
      <span
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 truncate",
          "bg-gradient-to-t from-black/90 to-transparent px-2.5 pb-1.5 pt-7",
          "text-sm lowercase text-white opacity-0 transition-opacity duration-200",
          "group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none",
        )}
      >
        {item.title}
      </span>
    </>
  );

  const boxClass = cn(
    "group relative block overflow-hidden border border-white/12 bg-white/[0.02] outline-none",
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
