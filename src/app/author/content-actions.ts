"use server";

import { redirect } from "next/navigation";
import { pathSegmentSlug } from "@/lib/github";
import { requireAdminServer } from "@/lib/auth-server";
import {
  createOperatorArticleByPath,
  createOperatorDrawingAssetByPath,
  deleteOperatorArticleByPath,
  deleteOperatorImageAssetByPath,
  saveOperatorArticleByPath,
  uploadOperatorImageByPath,
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
    return "/author";
  }

  return `/author/${pathSegments.map(pathSegmentSlug).join("/")}`;
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
  return createOperatorDrawingAssetByPath(input);
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
}

export async function uploadImageAction(input: {
  articlePath: string[];
  data: string;
  filename: string;
  mimeType: string;
}) {
  await requireAdminServer();
  return uploadOperatorImageByPath(input);
}

export async function deleteOperatorEntryAction(input: {
  kind: "article";
  pathSegments: string[];
}) {
  await requireAdminServer();

  if (input.kind === "article") {
    await deleteOperatorArticleByPath(input.pathSegments);
  }
}
