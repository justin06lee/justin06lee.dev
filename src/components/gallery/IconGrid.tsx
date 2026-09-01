import { cn } from "@/lib/utils";
import type { MangaPiece } from "./MangaPages";

export type IconGridProps = {
  items: MangaPiece[];
  className?: string;
  ariaLabel?: string;
};

/**
 * App icons, hung as a calm uniform grid.
 *
 * The opposite treatment to the manga pages on purpose: an icon is a designed
 * square with its own padding and corner radius, so cropping it or stretching
 * it into a composed panel would vandalise the thing being shown. Every tile is
 * the same size, the art is `object-contain` inside it, and the tile keeps
 * breathing room — the variation lives in the icons themselves.
 */
export function IconGrid({ items, className, ariaLabel }: IconGridProps) {
  return (
    <ul
      aria-label={ariaLabel}
      className={cn(
        "grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
        className,
      )}
    >
      {items.map((item) => (
        <li key={item.id}>
          <Tile item={item} />
        </li>
      ))}
    </ul>
  );
}

function Tile({ item }: { item: MangaPiece }) {
  const inner = (
    <>
      <span className="flex aspect-square w-full items-center justify-center overflow-hidden p-3">
        {item.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.src}
            alt={item.title}
            loading="lazy"
            draggable={false}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <span className="text-center font-mono text-xs lowercase text-white/40">
            {item.title}
          </span>
        )}
      </span>
      <span className="block truncate border-t border-white/10 px-3 py-2 text-xs lowercase text-white/60 transition-colors group-hover:text-white">
        {item.title}
      </span>
    </>
  );

  const boxClass = cn(
    "group block border border-white/12 bg-white/[0.02] outline-none",
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
