"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { motion } from "motion/react";
import { ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/chrome/badge";
import { Chrome, CHROME_FOIL_STYLE, CHROME_GLOW_STYLE } from "@/components/chrome/chrome";
import { Menu, type MenuItem } from "@/components/chrome/menu";
import {
  Card,
  CardHeader,
  CardTitle,
  CardMeta,
  CardBody,
  CardActions,
} from "@/components/chrome/card";

export type GalleryItem = {
  id: string;
  title: string;
  /** Optional link wrapping the title. External URLs open in a new tab. */
  link?: string;
  description: string;
  year: number;
  tech: string[];
  /** "View Code" link. */
  repo?: string;
  /** "Live" link. */
  live?: string;
  /** Muted italic line under the description. */
  notes?: string;
  /** Pins the item to the front; its pin marker and title get the chrome foil treatment. */
  pinned?: boolean;
};

export type GallerySort = "newest" | "oldest" | "az" | "za";

export type GalleryProps = {
  title: string;
  subtitle?: string;
  items?: GalleryItem[];
  initialSort?: GallerySort;
  /** Base animation delay (seconds) before the first staggered element. */
  chipBase?: number;
  /** Per-element stagger step (seconds). */
  chipStep?: number;
  className?: string;
};

const SORT_LABEL: Record<GallerySort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  az: "A–Z",
  za: "Z–A",
};

const SORT_KEYS: GallerySort[] = ["newest", "oldest", "az", "za"];

// lucide's `pin` glyph (v0.540) as a CSS mask. Chrome paints its foil via
// `background-clip: text`, which only clips to text glyphs — an SVG stroke
// can't take it. So the pinned marker paints the same gradient stack onto a
// plain span and clips it to the pin shape with a mask instead.
const PIN_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>',
)}")`;

// The chrome paint stack + shine animation come straight from the chrome
// component, so the icon shimmers in phase with the <Chrome> title next to it
// (which also injects the keyframes). The `data-chrome` attribute on the span
// opts it into Chrome's prefers-reduced-motion freeze.
const PIN_FOIL_STYLE: CSSProperties = {
  ...CHROME_FOIL_STYLE,
  WebkitMaskImage: PIN_MASK,
  WebkitMaskSize: "100% 100%",
  maskImage: PIN_MASK,
  maskSize: "100% 100%",
};

// Chrome's bevel + glow, applied on a wrapper: filters run before masks in the
// CSS effects pipeline, so a drop-shadow on the masked span itself would be
// clipped away with the box. On the parent it shadows the masked pin shape.
const PIN_GLOW_STYLE: CSSProperties = CHROME_GLOW_STYLE;

/**
 * Searchable / filterable / sortable card grid. A sort menu, tag filter chips,
 * and a search input drive a responsive grid of project cards (chrome-foiled
 * pinned marker + title, tech chips, repo / live links). Generalized from the
 * justin06lee.dev item gallery. Dark-only.
 */
export function Gallery({
  title,
  subtitle = "A curated list of things I've built or explored.",
  items = [],
  initialSort = "newest",
  chipBase = 0.4,
  chipStep = 0.1,
  className,
}: GalleryProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [sort, setSort] = useState<GallerySort>(initialSort);
  const [hasMounted, setHasMounted] = useState(false);

  // After the initial entrance, stop applying staggered delays — filtering or
  // searching should update the grid instantly, not replay the stagger.
  // (Already-running entrance animations keep their original delays.)
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    items.forEach((p) => p.tech.forEach((t) => s.add(t)));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const res = items.filter((p) => {
      const text = `${p.title} ${p.description} ${p.tech.join(" ")}`.toLowerCase();
      const matchesQ = q === "" || text.includes(q);
      const matchesTags =
        selected.length === 0 || selected.every((t) => p.tech.includes(t));
      return matchesQ && matchesTags;
    });

    res.sort((a, b) => {
      const pinDiff = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if (pinDiff !== 0) return pinDiff;
      switch (sort) {
        case "newest":
          return b.year - a.year || a.title.localeCompare(b.title);
        case "oldest":
          return a.year - b.year || a.title.localeCompare(b.title);
        case "az":
          return a.title.localeCompare(b.title);
        case "za":
          return b.title.localeCompare(a.title);
      }
    });

    return res;
  }, [items, query, selected, sort]);

  const toggleTag = (t: string) => {
    setSelected((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const sortItems: MenuItem[] = SORT_KEYS.map((key) => ({
    label: SORT_LABEL[key],
    onSelect: () => setSort(key),
    selected: sort === key,
  }));

  // Only stagger on the first render.
  const shouldAnimate = !hasMounted;
  const animStart = shouldAnimate ? chipBase + allTags.length * chipStep : 0;

  return (
    <main className={cn("mx-auto max-w-6xl px-4 pb-24 pt-16", className)}>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <p className="mt-1 text-sm text-white/70">{subtitle}</p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-sm"
        >
          <Menu
            align="right"
            label="Sort by"
            items={sortItems}
            trigger={
              <>
                <ListFilter className="size-4" aria-hidden />
                <span>Sort: {SORT_LABEL[sort]}</span>
              </>
            }
          />
        </motion.div>
      </div>

      <div className="mb-5">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <input
            type="text"
            placeholder="Search items, tech…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border border-white/20 bg-black px-4 py-2 text-white outline-none placeholder:text-white/40 focus:border-white/40"
          />
        </motion.div>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {allTags.map((t, i) => (
          <motion.div
            key={t}
            initial={shouldAnimate ? { opacity: 0, y: -10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.8,
              delay: shouldAnimate ? chipBase + i * chipStep : 0,
            }}
          >
            <Badge
              variant="ghost"
              active={selected.includes(t)}
              onClick={() => toggleTag(t)}
              className="px-3 py-1 text-sm"
            >
              {t}
            </Badge>
          </motion.div>
        ))}

        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => setSelected([])}
            className="-mt-1 px-2 text-sm text-white underline-offset-4 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="py-24 text-center text-white/60">
          No items match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p, i) => (
            <ProjectCard
              key={p.id}
              item={p}
              index={i}
              start={animStart}
              shouldAnimate={shouldAnimate}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function ProjectCard({
  item,
  index,
  start,
  shouldAnimate,
}: {
  item: GalleryItem;
  index: number;
  start: number;
  shouldAnimate: boolean;
}) {
  return (
    <motion.div
      initial={shouldAnimate ? { opacity: 0, y: -10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.8,
        delay: shouldAnimate ? start + index * 0.1 : 0,
      }}
    >
      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-start gap-1.5">
            {item.pinned && (
              <span
                role="img"
                aria-label="Pinned"
                className="mt-1 size-3.5 shrink-0"
                style={PIN_GLOW_STYLE}
              >
                <span
                  data-chrome
                  className="block size-full -rotate-45"
                  style={PIN_FOIL_STYLE}
                />
              </span>
            )}
            <CardTitle href={item.link}>
              {item.pinned ? <Chrome>{item.title}</Chrome> : item.title}
            </CardTitle>
          </div>
          <CardMeta>{item.year}</CardMeta>
        </CardHeader>

        <CardBody>{item.description}</CardBody>
        {item.notes && (
          <p className="text-xs italic text-white/60">{item.notes}</p>
        )}

        <div className="mt-1 flex flex-wrap gap-2">
          {item.tech.map((t) => (
            <Badge key={t} variant="outline">
              {t}
            </Badge>
          ))}
        </div>

        {(item.repo || item.live) && (
          <CardActions>
            {item.repo && (
              <a
                href={item.repo}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 text-sm text-white underline-offset-4 hover:underline"
              >
                View Code
              </a>
            )}
            {item.live && (
              <a
                href={item.live}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 text-sm text-white underline-offset-4 hover:underline"
              >
                Live
              </a>
            )}
          </CardActions>
        )}
      </Card>
    </motion.div>
  );
}
