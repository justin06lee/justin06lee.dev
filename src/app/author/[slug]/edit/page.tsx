import { notFound } from "next/navigation";
import { buildArticleDraft } from "@/lib/article-draft";
import { resolveArticleSegment } from "@/lib/github";
import {
  getOperatorArticleDraftByPath,
  getOperatorImageAssetsByPath,
  operatorArticlePreviewBaseUrlByPath,
} from "@/lib/operator-content";
import { OperatorArticleEditor } from "../../OperatorArticleEditor";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function OperatorEditPage({ params }: Props) {
  const { slug } = await params;
  const actualName = await resolveArticleSegment(slug, { noCache: true });
  if (!actualName) notFound();

  const articlePath = [actualName];
  const draft = await getOperatorArticleDraftByPath(articlePath);

  if (!draft) {
    notFound();
  }

  const assets = await getOperatorImageAssetsByPath(articlePath);

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6">
      <OperatorArticleEditor
        articlePath={articlePath}
        initialAssets={assets}
        initialRaw={
          draft.raw ??
          buildArticleDraft({
            title: actualName || "Untitled",
          })
        }
        initialSha={draft.sha}
        previewBaseUrl={operatorArticlePreviewBaseUrlByPath(articlePath)}
      />
    </main>
  );
}
