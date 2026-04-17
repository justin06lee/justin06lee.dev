import Navbar from "@/components/Navbar";
import ArticleList from "@/components/ArticleList";
import { listArticleSummaries } from "@/lib/github";

export default async function ArticlesPage() {
  const articles = await listArticleSummaries();

  return (
    <>
      <Navbar />
      <ArticleList
        articles={articles.map((a) => ({
          slug: a.slug,
          title: a.title,
          excerpt: a.excerpt ?? "",
          banner_url: a.coverUrl,
          tags: a.tags,
          published_at: null,
        }))}
      />
    </>
  );
}
