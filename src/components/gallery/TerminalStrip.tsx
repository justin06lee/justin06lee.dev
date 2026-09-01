import { cn } from "@/lib/utils";
import type { MangaPiece } from "./MangaPages";

export type TerminalStripProps = {
  items: MangaPiece[];
  className?: string;
  ariaLabel?: string;
};

/**
 * Pixel-art and terminal pieces.
 *
 * These are the one family that must NOT be resampled smoothly — a pixel banner
 * blurred by the browser's default filtering stops being pixel art. Each tile
 * renders with `image-rendering: pixelated` and sits on a bordered card with a
 * mono caption, so the section reads like a row of little terminal windows.
 * Art is contained rather than cropped for the same reason as the icons: these
 * are composed images, not photographs to be framed.
 */
export function TerminalStrip({ items, className, ariaLabel }: TerminalStripProps) {
  return (
    <ul
      aria-label={ariaLabel}
      className={cn(
        "grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-6 lg:grid-cols-6",
        className,
      )}
    >
      {items.map((item, index) => (
        <li key={item.id} className={cellClass(index, items.length)}>
          <Card item={item} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Six grid tracks let a row hold either three 2-track cards or two 3-track
 * cards. Complete rows stay three-across; a two-card tail expands to fill, and
 * a four-card tail becomes a balanced 2x2 instead of 3+an orphan. On the
 * two-column tablet grid, an odd final card gets the whole row for the same
 * reason.
 */
function cellClass(index: number, count: number): string {
  const mobileTail = count % 2 === 1 && index === count - 1;

  let desktopSpan = "lg:col-span-2";
  const remainder = count % 3;
  if (count === 1) {
    desktopSpan = "lg:col-span-6";
  } else if (remainder === 2 && index >= count - 2) {
    desktopSpan = "lg:col-span-3";
  } else if (remainder === 1 && index >= count - 4) {
    desktopSpan = "lg:col-span-3";
  }

  return cn("sm:col-span-3", mobileTail && "sm:col-span-6", desktopSpan);
}

function Card({ item }: { item: MangaPiece }) {
  const inner = (
    <>
      <span className="flex items-center gap-1.5 border-b border-white/12 px-3 py-2">
        <span className="size-2 shrink-0 rounded-full bg-white/25" aria-hidden />
        <span className="size-2 shrink-0 rounded-full bg-white/15" aria-hidden />
        <span className="size-2 shrink-0 rounded-full bg-white/10" aria-hidden />
        <span className="ml-1.5 truncate font-mono text-[11px] lowercase tracking-wide text-white/50 transition-colors group-hover:text-white/80">
          {item.title}
        </span>
      </span>
      <span className="flex aspect-[16/9] w-full items-center justify-center overflow-hidden p-4">
        {item.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.src}
            alt={item.title}
            loading="lazy"
            draggable={false}
            className="max-h-full max-w-full object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        ) : (
          <span className="font-mono text-xs lowercase text-white/40">{item.title}</span>
        )}
      </span>
    </>
  );

  const boxClass = cn(
    "group block border border-white/12 bg-black outline-none",
    "transition-colors duration-200 hover:border-white/35 focus-visible:border-white/60",
    "motion-reduce:transition-none",
  );

  if (!item.href) {
    return <div className={boxClass}>{inner}</div>;
  }
  return (
    <a
      href={item.href}
      aria-label={item.title}
      className={boxClass}
      target="_blank"
      rel="noopener noreferrer"
    >
      {inner}
    </a>
  );
}
