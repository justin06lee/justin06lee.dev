"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  DESIGN_WIDTH,
  wallHeight,
  type Placement,
  type WallVariant,
} from "@/lib/gallery-wall";
import type { WallPieceData } from "@/lib/project-images";

export type WallPiece = WallPieceData & {
  desktop: Placement;
  mobile: Placement;
};

export type ProjectWallProps = {
  pieces: WallPiece[];
  /** Viewport width (px) at or above which the desktop arrangement is used. */
  breakpoint?: number;
  className?: string;
  ariaLabel?: string;
};

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/**
 * The hand-arranged projects wall.
 *
 * Two independent arrangements are stored per piece — one authored on a
 * 1200-unit canvas, one on a 390-unit canvas — and the wall picks between them
 * by measured container width, then scales the chosen one by
 * `containerWidth / DESIGN_WIDTH`. Because every box is expressed in design
 * units rather than pixels, the composition is preserved exactly at every
 * viewport; only the scale factor changes. That is what makes the editor
 * WYSIWYG: there is no reflow to diverge from.
 *
 * Rendering is a scaled absolute-positioned layer rather than CSS `transform:
 * scale()` on a fixed canvas, so text and borders stay crisp and the wall
 * occupies its true laid-out height in the document flow.
 */
export function ProjectWall({
  pieces,
  breakpoint = 768,
  className,
  ariaLabel,
}: ProjectWallProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  // Start at the desktop design width so the server render and the first client
  // paint agree; the observer corrects it before paint on the client.
  const [width, setWidth] = React.useState(DESIGN_WIDTH.desktop);

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

  const variant: WallVariant = width >= breakpoint ? "desktop" : "mobile";
  const design = DESIGN_WIDTH[variant];
  const scale = width / design;

  const placements = pieces.map((p) => (variant === "desktop" ? p.desktop : p.mobile));
  const height = wallHeight(placements) * scale;

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={ariaLabel}
      className={cn("relative w-full", className)}
      style={{ height }}
    >
      {pieces.map((piece, i) => (
        <Piece
          key={piece.id}
          piece={piece}
          placement={placements[i]}
          scale={scale}
        />
      ))}
    </div>
  );
}

function Piece({
  piece,
  placement,
  scale,
}: {
  piece: WallPiece;
  placement: Placement;
  scale: number;
}) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: placement.x * scale,
    top: placement.y * scale,
    width: placement.w * scale,
    height: placement.h * scale,
  };

  const inner = (
    <>
      {piece.src ? (
        // object-cover, not contain: on a hand-arranged wall the author sized
        // the box deliberately, so the box is the intent and the image fills
        // it. (The auto salon does the opposite — there the image's aspect
        // drives the box, so it must never crop.)
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={piece.src}
          alt={piece.title}
          loading="lazy"
          draggable={false}
          className="block h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-3 text-center font-mono text-xs lowercase tracking-wide text-white/50">
          {piece.title}
        </div>
      )}
      <span
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-1.5 pt-6",
          "text-sm lowercase text-white opacity-0 transition-opacity duration-200",
          "group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none",
        )}
      >
        {piece.title}
      </span>
    </>
  );

  const boxClass = cn(
    "group block overflow-hidden border border-transparent bg-white/[0.02] outline-none",
    "transition-colors duration-200 hover:border-white/40 focus-visible:border-white/60 motion-reduce:transition-none",
  );

  if (!piece.href) {
    return (
      <div className={boxClass} style={style} aria-label={piece.title}>
        {inner}
      </div>
    );
  }

  return (
    <a
      href={piece.href}
      aria-label={piece.title}
      className={boxClass}
      style={style}
      target="_blank"
      rel="noopener noreferrer"
    >
      {inner}
    </a>
  );
}
