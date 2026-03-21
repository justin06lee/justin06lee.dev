import Navbar from "@/components/Navbar";
import ArticleList from "@/components/ArticleList";
import { getPublishedArticles } from "@/lib/articles";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  const articles = await getPublishedArticles();

  return (
    <>
      <Navbar />
      <ArticleList
        articles={articles.map((a) => ({
          slug: a.slug,
          title: a.title,
          excerpt: a.excerpt,
          banner_url: a.banner_url,
          tags: a.tags,
          published_at: a.published_at,
        }))}
      />
    </>
  );
}
