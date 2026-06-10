"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getArticleByPath, pathSegmentSlug, routeForPath } from "@/lib/github";
import { normalizePrerequisitePath } from "@/lib/article-draft";
import { requireAdminServer } from "@/lib/auth-server";
import {
  createOperatorArticleByPath,
  createOperatorDrawingAssetByPath,
  deleteOperatorArticleByPath,
  deleteOperatorImageAssetByPath,
  saveOperatorArticleByPath,
} from "@/lib/operator-content";

export type OperatorFormState =
  | {
      error?: string;
      message?: string;
      sha?: string;
    }
  | null;

function stringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parsePathField(value: string): string[] {
  return value
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function operatorRouteForPath(pathSegments: string[]) {
  if (pathSegments.length === 0) {
    return "/desk";
  }

  return `/desk/${pathSegments.map(pathSegmentSlug).join("/")}`;
}

export async function createArticleAction(
  _prevState: OperatorFormState,
  formData: FormData
): Promise<OperatorFormState> {
  const article = stringField(formData, "article");
  const title = stringField(formData, "title");
  const prerequisites = stringField(formData, "prerequisites")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const content = stringField(formData, "content");
  const slug = article || title;
  const redirectPath = `${operatorRouteForPath([slug])}/edit`;

  try {
    await requireAdminServer();
    // reject prerequisites that don't resolve to a real article so we never
    // persist dangling references the reader would hit as broken links.
    for (const prereq of prerequisites) {
      const parts = normalizePrerequisitePath(prereq).split("/").filter(Boolean);
      if (parts.length === 0) continue;
      const exists = await getArticleByPath(parts, { noCache: true });
      if (!exists) {
        return { error: `prerequisite not found: ${prereq}` };
      }
    }
    await createOperatorArticleByPath({
      slug,
      content,
      prerequisites,
      title,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to create article.",
    };
  }

  redirect(redirectPath);
}

export async function saveArticleAction(
  _prevState: OperatorFormState,
  formData: FormData
): Promise<OperatorFormState> {
  const articlePath = parsePathField(stringField(formData, "articlePath"));
  const raw = stringField(formData, "raw");
  const sha = stringField(formData, "sha") || undefined;

  try {
    await requireAdminServer();
    const result = await saveOperatorArticleByPath({
      pathSegments: articlePath,
      raw,
      sha,
    });

    // public article routes cache with revalidate: 3600; drop the list, the
    // specific article page, and desk so a save is reflected immediately.
    revalidatePath("/articles");
    revalidatePath(routeForPath(articlePath));
    revalidatePath("/desk");

    return {
      message: `Saved ${result.title}.`,
      sha: result.sha,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to save article.",
      sha,
    };
  }
}

export async function saveDrawingAction(input: {
  articlePath: string[];
  darkDataUrl: string;
  lightDataUrl: string;
  name?: string;
}) {
  await requireAdminServer();
  const result = await createOperatorDrawingAssetByPath(input);
  // the public article page caches for an hour; revalidate it so the newly
  // created drawing appears without waiting for the cache to expire.
  revalidatePath(routeForPath(input.articlePath));
  revalidatePath("/articles");
  return result;
}

export async function deleteImageAction(input: {
  articlePath: string[];
  darkFilename?: string;
  darkSha?: string;
  filename: string;
  sha: string;
}) {
  await requireAdminServer();
  await deleteOperatorImageAssetByPath(input);
  // keep the public article page in sync with the removed asset.
  revalidatePath(routeForPath(input.articlePath));
  revalidatePath("/articles");
}

export async function deleteOperatorEntryAction(input: {
  kind: "article";
  pathSegments: string[];
}) {
  await requireAdminServer();

  if (input.kind === "article") {
    await deleteOperatorArticleByPath(input.pathSegments);
    // drop the public list and the now-deleted article page from cache.
    revalidatePath(routeForPath(input.pathSegments));
    revalidatePath("/articles");
  }
}
