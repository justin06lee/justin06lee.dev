import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import { getArticleBySlug } from "@/lib/articles";
import ArticleView from "./article-view";

export const dynamic = "force-dynamic";

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) notFound();

  return (
    <>
      <Navbar />
      <ArticleView article={article} />
    </>
  );
}
