"use client";

import Link from "next/link";
import { Article } from "@/components/chrome/article";
import { CollapsibleProse } from "@/components/chrome/collapsible-prose";
import { Prose } from "@/components/chrome/prose";
import { getThemeImageVariant } from "@/lib/theme-images";

// Site is forced-dark, so every light/dark image pair resolves to its dark
// variant. getThemeImageVariant only rewrites srcs carrying a -light/-dark
// suffix (leaving others untouched), and runs on the already-resolved src.
// Module-level so the reference stays stable and Prose can memoize its map.
const resolveDarkImage = (src: string) => getThemeImageVariant(src, "dark");

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
          <Prose
            imageBaseUrl={article.imageBaseUrl}
            linkComponent={Link}
            resolveImageSrc={resolveDarkImage}
          >
            {md}
          </Prose>
        )}
      >
        {article.content}
      </CollapsibleProse>
    </Article>
  );
}
