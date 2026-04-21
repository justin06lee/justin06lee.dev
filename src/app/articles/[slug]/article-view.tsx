"use client";

import { useState, useEffect, useCallback } from "react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CollapsibleMarkdown } from "@/components/article/collapsible-markdown";
import type { Annotation } from "@/lib/annotations";
import AnnotatedContent from "@/components/article/AnnotatedContent";
import AnnotationSidebar from "@/components/article/AnnotationSidebar";

export type ArticleViewData = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  banner_url: string | null;
  tags: string[];
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  imageBaseUrl: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function ArticleView({ article, isAdmin }: { article: ArticleViewData; isAdmin: boolean }) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [pendingMargin, setPendingMargin] = useState<{ paragraphIndex: number; position: "before" | "after" } | null>(null);

  const fetchAnnotations = useCallback(async () => {
    const res = await fetch(`/api/annotations?slug=${article.slug}`);
    if (res.ok) {
      const data = await res.json();
      setAnnotations(data.annotations);
    }
  }, [article.slug]);

  useEffect(() => { fetchAnnotations(); }, [fetchAnnotations]);

  const handleUpdate = async (id: string, patch: { comment?: string | null; public?: boolean }) => {
    await fetch(`/api/annotations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    fetchAnnotations();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/annotations/${id}`, { method: "DELETE" });
    fetchAnnotations();
  };

  const handleNewCommentSubmit = async () => {
    if (!pendingMargin || !newComment.trim()) return;
    await fetch("/api/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articleSlug: article.slug,
        type: "margin",
        paragraphIndex: pendingMargin.paragraphIndex,
        position: pendingMargin.position,
        comment: newComment.trim(),
      }),
    });
    setPendingMargin(null);
    setNewComment("");
    fetchAnnotations();
  };

  return (
    <main className="max-w-5xl mx-auto px-4 pt-16 pb-24">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1 }}
      >
        <Link
          href="/articles"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-8"
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
          className="mb-8 overflow-hidden border border-border"
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

        <div className="flex items-center gap-3 mt-3 text-sm text-muted">
          {article.published_at && <time>{formatDate(article.published_at)}</time>}
          {article.tags.length > 0 && (
            <>
              {article.published_at && <span className="text-border">|</span>}
              <div className="flex gap-1.5">
                {article.tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 text-xs border border-border text-muted">
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
        <div className={`${isAdmin || annotations.length > 0 ? "lg:grid lg:grid-cols-[1fr_280px] lg:gap-8" : ""}`}>
          <AnnotatedContent
            slug={article.slug}
            annotations={annotations}
            isAdmin={isAdmin}
            onAnnotationCreated={fetchAnnotations}
            onPendingMargin={(info) => { setPendingMargin(info); setNewComment(""); }}
          >
            <CollapsibleMarkdown
              content={article.content}
              imageBaseUrl={article.imageBaseUrl}
            />
          </AnnotatedContent>
          {(isAdmin || annotations.length > 0) && (
            <AnnotationSidebar
              annotations={annotations}
              isAdmin={isAdmin}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              editingId={editingId}
              onEditingChange={setEditingId}
              newComment={newComment}
              onNewCommentChange={setNewComment}
              onNewCommentSubmit={handleNewCommentSubmit}
              pendingParagraph={pendingMargin}
            />
          )}
        </div>
      </motion.div>
    </main>
  );
}
