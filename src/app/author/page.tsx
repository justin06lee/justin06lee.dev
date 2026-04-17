import Link from "next/link";
import { listArticleSummaries } from "@/lib/github";
import { OperatorFileGrid } from "./OperatorFileGrid";

const OP = { noCache: true as const };

export default async function AuthorHome() {
  const articles = await listArticleSummaries(OP);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 flex flex-wrap gap-3">
        <Link
          href="/author/new-article"
          className="border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-alt"
        >
          New article
        </Link>
      </div>

      <h1 className="mb-2 text-4xl tracking-tight text-foreground">Archive</h1>
      <p className="mb-10 text-muted">
        Browse and edit articles (uncached).
      </p>

      {articles.length > 0 ? (
        <>
          <h2 className="px-8 text-xs font-semibold uppercase tracking-wider text-muted">
            Articles
          </h2>
          <OperatorFileGrid
            items={articles.map((article) => ({
              href: `/author/${article.slug}`,
              name:
                article.pathSegments[article.pathSegments.length - 1] ??
                article.slug,
              pathSegments: article.pathSegments,
            }))}
          />
        </>
      ) : (
        <p className="text-muted">No articles yet. Create your first one.</p>
      )}
    </main>
  );
}
