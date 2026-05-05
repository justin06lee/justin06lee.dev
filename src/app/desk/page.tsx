import { listArticleSummaries } from "@/lib/github";
import { OperatorFileGrid } from "./OperatorFileGrid";

const OP = { noCache: true as const };

export default async function DeskHome() {
  const articles = await listArticleSummaries(OP);

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">archive</h1>
        <p className="mt-2 text-sm text-white/50">
          browse and edit articles. uncached.
        </p>
      </div>

      {articles.length > 0 ? (
        <OperatorFileGrid
          items={articles.map((article) => ({
            href: `/desk/${article.slug}`,
            name:
              article.pathSegments[article.pathSegments.length - 1] ??
              article.slug,
            pathSegments: article.pathSegments,
          }))}
        />
      ) : (
        <p className="text-sm text-white/50">no articles yet. create your first one.</p>
      )}
    </main>
  );
}
