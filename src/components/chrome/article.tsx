"use client";

import * as motion from "motion/react-client";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export type ArticleProps = {
  title: string;
  /** ISO date string or pre-formatted label. */
  date?: string;
  tags?: string[];
  /** Banner image URL shown above the title. */
  banner?: string;
  /** Renders a back link above the banner. */
  backHref?: string;
  backLabel?: string;
  className?: string;
  /** Article body — typically <Prose>{markdown}</Prose>. */
  children?: React.ReactNode;
};

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value; // already a label
  return d.toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" });
}

/**
 * Article reading layout — back link, banner, title, date + tags, then the
 * body. Staggered fade-ins match justin06lee.dev. Pass the body as children
 * (e.g. the `prose` component) so the renderer stays your choice.
 */
export function Article({
  title,
  date,
  tags = [],
  banner,
  backHref,
  backLabel = "back",
  className,
  children,
}: ArticleProps) {
  return (
    <article className={cn("mx-auto max-w-3xl select-text px-4 sm:px-6", className)}>
      {backHref && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <a
            href={backHref}
            className="mb-10 inline-flex items-center gap-1.5 text-sm text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            <ArrowLeft className="size-4" />
            {backLabel}
          </a>
        </motion.div>
      )}

      {banner && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mb-10 overflow-hidden border border-white/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} alt="" className="max-h-[400px] w-full object-cover" />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {title}
        </h1>

        {(date || tags.length > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            {date && (
              <time className="font-mono tabular-nums text-white/50">{formatDate(date)}</time>
            )}
            {date && tags.length > 0 && <span className="text-white/20">·</span>}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="border border-white/15 px-2 py-0.5 text-xs text-white/60">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.35 }}
        className="mt-12"
      >
        {children}
      </motion.div>
    </article>
  );
}
