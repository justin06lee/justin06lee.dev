import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleByPath, resolveArticleSegment, routeForPath, pathSegmentSlug } from "@/lib/github";
import { ArticleContent } from "@/components/article/article-content";
import { PrerequisitesSidebar } from "@/components/article/prerequisites-sidebar";

const OP = { noCache: true as const };

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function DeskArticlePage({ params }: Props) {
  const { slug } = await params;
  const actualName = await resolveArticleSegment(slug, OP);
  if (!actualName) notFound();

  const article = await getArticleByPath([actualName], OP);
  if (!article) notFound();

  return (
    <div>
      <div className="mx-auto flex max-w-7xl flex-wrap gap-2 px-4 sm:px-6 pb-6">
        <Link
          href={`/desk/${pathSegmentSlug(actualName)}/edit`}
          className="border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 transition-colors"
        >
          edit article
        </Link>
        <Link
          href={routeForPath([actualName])}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 transition-colors"
        >
          open public page
        </Link>
      </div>

      <div className="mx-auto flex max-w-7xl gap-0">
        <aside className="hidden w-52 shrink-0 border-r border-white/10 px-4 pt-8 lg:block">
          <ArticleContent content={article.content} mode="toc" />
        </aside>

        <main className="min-w-0 flex-1 px-4 sm:px-6 py-8 lg:px-12">
          <ArticleContent
            content={article.content}
            imageBaseUrl={article.rawPath}
            mode="content"
            title={article.title}
          />
        </main>

        <aside className="hidden w-60 shrink-0 border-l border-white/10 px-4 pt-8 xl:block">
          <PrerequisitesSidebar
            prerequisites={article.prerequisites}
            noCache
            basePath=""
          />
        </aside>
      </div>
    </div>
  );
}
