"use client";

import * as motion from "motion/react-client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CollapsibleMarkdown } from "@/components/article/collapsible-markdown";

export type ArticleViewData = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  banner_url: string | null;
  tags: string[];
  published_at: string | null;
  imageBaseUrl: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ArticleView({ article }: { article: ArticleViewData }) {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-24 select-text">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <Link
          href="/articles"
          className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white underline-offset-4 hover:underline transition-colors mb-10"
        >
          <ArrowLeft className="h-4 w-4" />
          back to articles
        </Link>
      </motion.div>

      {article.banner_url && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mb-10 overflow-hidden border border-white/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.banner_url}
            alt=""
            className="w-full max-h-[400px] object-cover"
          />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
          {article.title}
        </h1>

        {(article.published_at || article.tags.length > 0) && (
          <div className="flex flex-wrap items-center gap-3 mt-4 text-sm">
            {article.published_at && (
              <time className="font-mono tabular-nums text-white/50">
                {formatDate(article.published_at)}
              </time>
            )}
            {article.published_at && article.tags.length > 0 && (
              <span className="text-white/20">·</span>
            )}
            {article.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {article.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 text-xs border border-white/15 text-white/60"
                  >
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
        <CollapsibleMarkdown
          content={article.content}
          imageBaseUrl={article.imageBaseUrl}
        />
      </motion.div>
    </main>
  );
}
