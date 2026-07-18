import * as motion from "motion/react-client";
import Navbar from "@/components/Navbar";
import { ArticleList } from "@/components/chrome/article-list";
import { listArticleSummaries } from "@/lib/github";

export default async function ArticlesPage() {
  // Hidden articles are excluded from the public index (still shown in /desk).
  const articles = (await listArticleSummaries()).filter((a) => !a.hidden);

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <h1 className="text-2xl font-semibold tracking-tight">articles</h1>
          <p className="text-white/50 mt-1 text-sm">
            thoughts, guides, and stuff i find interesting.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-8"
        >
          <ArticleList
            articles={articles.map((a) => ({
              slug: a.slug,
              title: a.title,
              excerpt: a.excerpt ?? "",
              bannerUrl: a.coverUrl ?? undefined,
              tags: a.tags,
            }))}
            basePath="/articles"
          />
        </motion.div>
      </main>
    </div>
  );
}
