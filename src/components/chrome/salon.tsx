"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { justifyRows } from "@/components/chrome/salon-layout";

export type SalonItem = {
  /** Intrinsic image URL. Omit to render a typographic placard in the same slot. */
  src?: string;
  /** Intrinsic pixel width — drives the aspect ratio, not the render size. */
  width: number;
  /** Intrinsic pixel height. */
  height: number;
  /** Where clicking the piece goes. Internal hrefs route through `linkComponent`. */
  href?: string;
  /** Alt text / accessible name for the piece. */
  alt?: string;
  /** A placard shown over the piece on hover/focus (and the placard's own text when `src` is absent). */
  title?: React.ReactNode;
  /** External destination — opens in a new tab and always renders a plain `<a>`. */
  external?: boolean;
};

export type SalonProps = {
  /** The pieces to hang, each at its own aspect ratio. */
  items: SalonItem[];
  /** Ideal row height in px before a row is justified to fill the width. Defaults to 260. */
  targetRowHeight?: number;
  /** Gap between pieces (and rows) in px. Defaults to 12. */
  gap?: number;
  /**
   * How tall a trailing, un-fillable row is allowed to grow before it stops
   * stretching and simply left-aligns at the target height. Defaults to
   * `targetRowHeight * 1.5`.
   */
  maxRowHeight?: number;
  /** Container max width in px. Defaults to unbounded (fills its parent). */
  maxWidth?: number;
  /** Assumed width for the first (server) render, before the container is measured. Defaults to 1040. */
  assumedWidth?: number;
  /** Router link for internal hrefs (e.g. next/link). Defaults to a plain `<a>`. External hrefs always stay `<a>`. */
  linkComponent?: React.ElementType;
  /** Accessible name for the wall region. */
  ariaLabel?: string;
  className?: string;
};

// Layout must settle before paint on the client, but useLayoutEffect warns
// during SSR; fall back to useEffect on the server render.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/**
 * A salon hang: a wall of images shown at their own aspect ratios, packed into
 * justified rows that each fill the width.
 *
 * `gallery` is the uniform searchable grid — every project the same card, sized
 * to a column. `shelf` is one horizontal row you skim. A salon is neither: the
 * pieces keep their real proportions, a tall poster next to a wide banner next
 * to a square, and the point is the varied hang itself. It is what you reach for
 * when the images *are* the content and their shapes carry meaning.
 *
 * Rows are justified with the standard greedy fill: pieces accumulate until the
 * height that would make the row span the width drops to the target, then the
 * row closes at exactly that height. Every piece in a row therefore shares a
 * height and keeps its aspect ratio, and the row edges line up. Because the
 * computed box has the piece's own aspect ratio, the image fills it with no crop.
 *
 * The last row can't usually be filled without stretching a stray piece to a
 * billboard, so it left-aligns at the target height instead — unless it happens
 * to nearly fill, in which case it justifies like any other (`maxRowHeight` is
 * the cutoff). The container is measured with a ResizeObserver so the hang
 * reflows on resize; the first paint uses `assumedWidth` so server and client
 * markup agree before that measurement lands.
 */
export function Salon({
  items,
  targetRowHeight = 260,
  gap = 12,
  maxRowHeight,
  maxWidth,
  assumedWidth = 1040,
  linkComponent,
  ariaLabel,
  className,
}: SalonProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(assumedWidth);

  useIsomorphicLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setWidth(w);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rows = React.useMemo(
    () => justifyRows(items, width, gap, targetRowHeight, maxRowHeight ?? targetRowHeight * 1.5),
    [items, width, gap, targetRowHeight, maxRowHeight],
  );

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={ariaLabel}
      className={cn("flex w-full flex-col", className)}
      style={{ gap, maxWidth }}
    >
      {rows.map((row, ri) => (
        <div key={ri} className="flex" style={{ gap }}>
          {row.items.map((item, ii) => (
            <Piece
              key={item.src ?? `${ri}-${ii}`}
              item={item}
              width={row.height * (item.width / item.height)}
              height={row.height}
              linkComponent={linkComponent}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Piece({
  item,
  width,
  height,
  linkComponent,
}: {
  item: SalonItem;
  width: number;
  height: number;
  linkComponent?: React.ElementType;
}) {
  const isExternal = item.external || /^https?:\/\//.test(item.href ?? "");
  const Link = !isExternal && item.href && linkComponent ? linkComponent : "a";

  const inner = (
    <>
      {item.src ? (
        // Intrinsic width/height give the browser the true aspect ratio — a
        // viewBox-only SVG otherwise has no intrinsic size and object-fit falls
        // back to 300x150, cropping. object-contain guarantees the whole piece
        // shows: the box is already the image's aspect, so it fills edge to
        // edge, and any dimension mismatch letterboxes rather than crops.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.src}
          alt={item.alt ?? ""}
          width={item.width}
          height={item.height}
          loading="lazy"
          draggable={false}
          className="block h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-4 text-center font-mono text-xs lowercase tracking-wide text-white/50">
          {item.title ?? item.alt ?? "untitled"}
        </div>
      )}
      {item.title && (
        <span
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-1.5 pt-6",
            "text-sm lowercase text-white opacity-0 transition-opacity duration-200",
            "group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none",
          )}
        >
          {item.title}
        </span>
      )}
    </>
  );

  const boxClass = cn(
    "group relative block shrink-0 overflow-hidden border border-white/15 bg-white/[0.02]",
    "outline-none transition-colors duration-200 hover:border-white/40 focus-visible:border-white/60 motion-reduce:transition-none",
  );
  const style: React.CSSProperties = { width, height };

  if (!item.href) {
    return (
      <div className={boxClass} style={style} aria-label={item.alt}>
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      aria-label={item.alt || (typeof item.title === "string" ? item.title : undefined)}
      className={boxClass}
      style={style}
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {inner}
    </Link>
  );
}
