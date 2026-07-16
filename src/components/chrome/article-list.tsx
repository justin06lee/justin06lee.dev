"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/chrome/badge";
import { FadeIn, staggerDelay } from "@/components/chrome/fade-in";

export type ArticlePreview = {
  slug: string;
  title: string;
  excerpt: string;
  bannerUrl?: string;
  tags: string[];
  publishedAt?: string;
};

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso; // already a label
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type BannerStill = {
  /** Frozen first frame as a data URL, or null when fetch/decode failed. */
  still: string | null;
  /** The fetched banner blob (for the hover swap), or null on failure. */
  blob: Blob | null;
};

// Module-level cache keyed by src: each banner is fetched + frozen once, even
// as cards remount (e.g. while typing in the search box). Holds the in-flight
// promise too, so concurrent cards share one fetch.
const bannerStillCache = new Map<string, Promise<BannerStill>>();

function loadBannerStill(src: string): Promise<BannerStill> {
  const cached = bannerStillCache.get(src);
  if (cached) return cached;
  const promise = fetch(src)
    .then((r) => r.blob())
    .then(
      (blob) =>
        new Promise<BannerStill>((resolve) => {
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            try {
              const c = document.createElement("canvas");
              c.width = img.naturalWidth;
              c.height = img.naturalHeight;
              c.getContext("2d")?.drawImage(img, 0, 0);
              resolve({ still: c.toDataURL("image/png"), blob });
            } catch {
              resolve({ still: null, blob: null });
            }
            URL.revokeObjectURL(url);
          };
          // Without an error path a failed decode would leak the blob url forever.
          img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({ still: null, blob: null });
          };
          img.src = url;
        }),
    )
    .catch((): BannerStill => ({ still: null, blob: null }));
  bannerStillCache.set(src, promise);
  // Don't pin failures — a later remount can retry.
  void promise.then((result) => {
    if (result.still === null) bannerStillCache.delete(src);
  });
  return promise;
}

function ArticleCard({
  article,
  basePath,
}: {
  article: ArticlePreview;
  basePath: string;
}) {
  const blobRef = useRef<Blob | null>(null);
  const gifUrlRef = useRef<string | null>(null);
  const wantsHover = useRef(false);
  const [stillSrc, setStillSrc] = useState<string | null>(null);
  const [gifSrc, setGifSrc] = useState<string | null>(null);

  // Fetch the banner, freeze its first frame to a still PNG via canvas, and
  // swap to the animated original only on hover. Keeps GIF / animated WebP
  // banners calm until the user shows interest.
  useEffect(() => {
    const src = article.bannerUrl;
    if (!src) return;
    let cancelled = false;
    void loadBannerStill(src).then(({ still, blob }) => {
      if (cancelled) return;
      blobRef.current = blob;
      // On fetch/decode failure (e.g. a cross-origin image without CORS
      // headers) fall back to the original, possibly animated, src.
      setStillSrc(still ?? src);
    });
    return () => {
      cancelled = true;
    };
  }, [article.bannerUrl]);

  useEffect(() => {
    return () => {
      if (gifUrlRef.current) URL.revokeObjectURL(gifUrlRef.current);
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    wantsHover.current = true;
    if (blobRef.current) {
      if (gifUrlRef.current) URL.revokeObjectURL(gifUrlRef.current);
      const url = URL.createObjectURL(blobRef.current);
      gifUrlRef.current = url;
      const img = new Image();
      img.onload = () => {
        if (wantsHover.current) setGifSrc(url);
      };
      // Drop the url on decode failure so the blob isn't pinned indefinitely.
      img.onerror = () => {
        if (gifUrlRef.current === url) {
          URL.revokeObjectURL(url);
          gifUrlRef.current = null;
        }
      };
      img.src = url;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    wantsHover.current = false;
    if (gifUrlRef.current) {
      URL.revokeObjectURL(gifUrlRef.current);
      gifUrlRef.current = null;
    }
    setGifSrc(null);
  }, []);

  const displaySrc = gifSrc ?? stillSrc;

  return (
    <a
      href={`${basePath}/${article.slug}`}
      className="group block border border-white/10 bg-white/[0.02] transition-colors hover:border-white/20 hover:bg-white/[0.04]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {article.bannerUrl && (
        <div className="relative h-44 overflow-hidden border-b border-white/10 bg-black">
          {displaySrc && (
            <img
              src={displaySrc}
              alt=""
              className={cn(
                "h-full w-full object-cover transition-all duration-500",
                !gifSrc &&
                  "grayscale brightness-50 group-hover:grayscale-0 group-hover:brightness-100",
              )}
            />
          )}
        </div>
      )}
      <div className="p-4">
        {/* flex-wrap lets the date drop below the title on narrow cards instead of overflowing */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h2 className="text-base font-semibold leading-snug text-white/80 transition-colors group-hover:text-white">
            {article.title}
          </h2>
          {article.publishedAt && (
            <span className="shrink-0 font-mono text-xs tabular-nums text-white/40">
              {formatDate(article.publishedAt)}
            </span>
          )}
        </div>
        {article.excerpt && (
          <p className="mt-1.5 line-clamp-2 text-sm text-white/50 transition-colors group-hover:text-white/70">
            {article.excerpt}
          </p>
        )}
        {article.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {article.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
        )}
      </div>
    </a>
  );
}

export type ArticleListProps = {
  /** Articles to render as cards. */
  articles: ArticlePreview[];
  /** Prefix for card hrefs, built as `${basePath}/${slug}`. */
  basePath?: string;
  /** Initial value of the search box. */
  defaultQuery?: string;
  /** Initially selected tag filter, if any. */
  defaultTag?: string;
  /** Stagger each card's entrance fade by index (capped). Default true. */
  stagger?: boolean;
  className?: string;
};

/**
 * Searchable, tag-filterable grid of article cards. Each card defers its
 * (possibly animated) GIF banner — showing a frozen, grayscale first frame
 * until hover, then swapping to the animated original in full color. Cards
 * stagger their entrance fade by index (via FadeIn, which honors
 * prefers-reduced-motion); pass `stagger={false}` to render instantly.
 * Dark-only. Uses plain <a> / <img> so it stays framework-agnostic.
 */
export function ArticleList({
  articles,
  basePath = "",
  defaultQuery = "",
  defaultTag,
  stagger = true,
  className,
}: ArticleListProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [selectedTag, setSelectedTag] = useState<string | null>(
    defaultTag ?? null,
  );

  const allTags = useMemo(() => {
    const s = new Set<string>();
    articles.forEach((a) => a.tags.forEach((t) => s.add(t)));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [articles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((a) => {
      const text = `${a.title} ${a.excerpt} ${a.tags.join(" ")}`.toLowerCase();
      const matchesQ = q === "" || text.includes(q);
      const matchesTag = !selectedTag || a.tags.includes(selectedTag);
      return matchesQ && matchesTag;
    });
  }, [articles, query, selectedTag]);

  return (
    <div className={cn("w-full", className)}>
      <input
        type="text"
        placeholder="Search articles..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 w-full border border-white/20 bg-black px-4 py-2 text-white outline-none transition-colors placeholder:text-white/40 focus:border-white/40"
      />

      {allTags.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-2">
          {allTags.map((t) => (
            <Badge
              key={t}
              variant="ghost"
              active={selectedTag === t}
              onClick={() => setSelectedTag(selectedTag === t ? null : t)}
            >
              {t}
            </Badge>
          ))}
          {selectedTag && (
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className="px-2 text-xs text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              clear
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-24 text-center text-sm text-white/40">
          no articles found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((article, i) =>
            stagger ? (
              // Delay grows 60ms per card but caps after 8 so a long list
              // doesn't keep late rows invisible. Keys are slugs, so cards
              // surviving a filter change keep their DOM and don't re-animate.
              <FadeIn key={article.slug} delay={staggerDelay(Math.min(i, 8), 0.06)}>
                <ArticleCard article={article} basePath={basePath} />
              </FadeIn>
            ) : (
              <ArticleCard
                key={article.slug}
                article={article}
                basePath={basePath}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
