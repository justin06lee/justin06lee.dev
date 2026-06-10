"use client";

import React, { useMemo, useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import * as motion from "motion/react-client";

export type ArticlePreview = {
  slug: string;
  title: string;
  excerpt: string;
  banner_url: string | null;
  tags: string[];
  published_at: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function ArticleCard({ article }: { article: ArticlePreview }) {
  const blobRef = useRef<Blob | null>(null);
  const gifUrlRef = useRef<string | null>(null);
  const wantsHover = useRef(false);
  const [stillSrc, setStillSrc] = useState<string | null>(null);
  const [gifSrc, setGifSrc] = useState<string | null>(null);

  // Fetch the cover, freeze the first frame as a still PNG, swap to the
  // animated original on hover. Lets GIF/animated WebP banners stay calm
  // until the user shows interest.
  useEffect(() => {
    if (!article.banner_url) return;
    let cancelled = false;
    fetch(article.banner_url)
      .then((r) => r.blob())
      .then((blob) => {
        if (cancelled) return;
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext("2d")?.drawImage(img, 0, 0);
          if (!cancelled) setStillSrc(c.toDataURL("image/png"));
          URL.revokeObjectURL(url);
        };
        // Without an error path a failed decode would leak the blob url forever.
        img.onerror = () => URL.revokeObjectURL(url);
        img.src = url;
      })
      .catch(() => {
        // Network/blob failure: nothing was allocated past this point, so just swallow.
      });
    return () => {
      cancelled = true;
    };
  }, [article.banner_url]);

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
    <Link
      href={`/articles/${article.slug}`}
      className="group block border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-colors"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {article.banner_url && (
        <div className="overflow-hidden h-44 relative bg-black border-b border-white/10">
          {displaySrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displaySrc}
              alt=""
              className={`w-full h-full object-cover transition-all duration-500 ${
                gifSrc ? "" : "grayscale brightness-50 group-hover:grayscale-0 group-hover:brightness-100"
              }`}
            />
          )}
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold leading-snug text-white/80 group-hover:text-white transition-colors">
            {article.title}
          </h2>
          {article.published_at && (
            <span className="text-xs text-white/40 shrink-0 mt-0.5 font-mono tabular-nums">
              {formatDate(article.published_at)}
            </span>
          )}
        </div>
        {article.excerpt && (
          <p className="text-sm mt-1.5 line-clamp-2 text-white/50 group-hover:text-white/70 transition-colors">
            {article.excerpt}
          </p>
        )}
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {article.tags.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 text-xs border border-white/10 text-white/40 group-hover:border-white/20 group-hover:text-white/60 transition-colors"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function ArticleList({ articles }: { articles: ArticlePreview[] }) {
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

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
    <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">articles</h1>
        <p className="text-white/50 mt-1 text-sm">
          thoughts, guides, and stuff i find interesting.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mt-8 mb-4"
      >
        <input
          type="text"
          placeholder="Search articles..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-black border border-white/20 px-4 py-2 outline-none focus:border-white/40 text-white placeholder:text-white/40"
        />
      </motion.div>

      {allTags.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-wrap items-center gap-2 mb-8"
        >
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSelectedTag(selectedTag === t ? null : t)}
              className={
                selectedTag === t
                  ? "px-3 py-1 text-xs bg-white text-black"
                  : "px-3 py-1 text-xs border border-white/15 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              }
            >
              {t}
            </button>
          ))}
          {selectedTag && (
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className="text-xs text-white/60 hover:text-white underline-offset-4 hover:underline px-2 transition-colors"
            >
              clear
            </button>
          )}
        </motion.div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center text-white/40 py-24 text-sm">no articles found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((article, i) => (
            <motion.div
              key={article.slug}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 + i * 0.06 }}
            >
              <ArticleCard article={article} />
            </motion.div>
          ))}
        </div>
      )}
    </main>
  );
}
