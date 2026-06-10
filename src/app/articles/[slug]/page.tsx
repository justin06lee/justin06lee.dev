import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getArticleByPath, resolveArticleSegment } from "@/lib/github";
import ArticleView from "./article-view";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const actualName = await resolveArticleSegment(slug);
  if (!actualName) return {};

  const article = await getArticleByPath([actualName]);
  if (!article) return {};

  const description = article.excerpt ?? undefined;
  const coverUrl = article.cover
    ? `${article.rawPath}/${article.cover.replace(/^\.?\/+/, "")}`
    : null;
  // og:image falls back to the site default (set in layout) when an article has no cover.
  const images = coverUrl ? [coverUrl] : undefined;

  return {
    title: article.title,
    description,
    alternates: { canonical: `/articles/${slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description,
      url: `/articles/${slug}`,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images,
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const actualName = await resolveArticleSegment(slug);
  if (!actualName) notFound();

  const article = await getArticleByPath([actualName]);
  if (!article) notFound();

  const coverUrl = article.cover
    ? `${article.rawPath}/${article.cover.replace(/^\.?\/+/, "")}`
    : null;

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <ArticleView
        article={{
          slug,
          title: article.title,
          excerpt: article.excerpt ?? "",
          content: article.content,
          banner_url: coverUrl,
          tags: article.tags,
          published_at: null,
          imageBaseUrl: article.rawPath,
        }}
      />
    </div>
  );
}
