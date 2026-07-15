"use client";

import { Article } from "@/components/chrome/article";
import { CollapsibleProse } from "@/components/chrome/collapsible-prose";
import { Prose } from "@/components/chrome/prose";

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

export default function ArticleView({ article }: { article: ArticleViewData }) {
  return (
    <Article
      title={article.title}
      date={article.published_at ?? undefined}
      tags={article.tags}
      banner={article.banner_url ?? undefined}
      backHref="/articles"
      backLabel="back to articles"
      className="pt-20 pb-24"
    >
      <CollapsibleProse
        renderMarkdown={(md) => (
          <Prose imageBaseUrl={article.imageBaseUrl}>{md}</Prose>
        )}
      >
        {article.content}
      </CollapsibleProse>
    </Article>
  );
}
