"use client";

import * as motion from "motion/react-client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import type { Article } from "@/lib/articles";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function ArticleView({ article }: { article: Article }) {
  return (
    <main className="max-w-3xl mx-auto px-4 pt-16 pb-24">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1 }}
      >
        <Link
          href="/articles"
          className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to articles
        </Link>
      </motion.div>

      {article.banner_url && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="mb-8 overflow-hidden border border-white/10"
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
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        <h1 className="text-3xl font-semibold tracking-tight leading-tight">
          {article.title}
        </h1>

        <div className="flex items-center gap-3 mt-3 text-sm text-white/50">
          {article.published_at && <time>{formatDate(article.published_at)}</time>}
          {article.tags.length > 0 && (
            <>
              <span className="text-white/20">|</span>
              <div className="flex gap-1.5">
                {article.tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 text-xs border border-white/15 text-white/50">
                    {t}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="mt-10"
      >
        <MarkdownRenderer content={article.content} />
      </motion.div>
    </main>
  );
}
