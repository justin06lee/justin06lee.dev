import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getArticleByPath, resolveArticleSegment } from "@/lib/github";
import ArticleView from "./article-view";

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
    <>
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
    </>
  );
}
