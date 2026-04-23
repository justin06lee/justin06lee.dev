import {
  normalizePrerequisitePath,
  parseArticleDraft,
} from "./article-draft";
import { contentsUrl, rawUrl } from "./github-paths";

const REVALIDATE = 3600;
const collator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

function headers(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  const h: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) {
    h["Authorization"] = `Bearer ${token}`;
  }
  return h;
}

export type FetchOptions = { noCache?: boolean };

function fetchOptions(opts?: FetchOptions): RequestInit {
  if (opts?.noCache) {
    return { cache: "no-store" as RequestCache };
  }
  return { next: { revalidate: REVALIDATE } };
}

export interface GitHubEntry {
  name: string;
  path: string;
  type: "file" | "dir";
}

export interface Article {
  content: string;
  cover: string | null;
  excerpt: string | null;
  prerequisites: string[];
  rawPath: string;
  tags: string[];
  title: string;
}

export interface ArticleSummary {
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  tags: string[];
  pathSegments: string[];
  href: string;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function getDirectoryContents(
  segments: string[],
  opts?: FetchOptions
): Promise<GitHubEntry[]> {
  const res = await fetch(contentsUrl(...segments), {
    headers: headers(),
    ...fetchOptions(opts),
  });

  if (!res.ok) {
    return [];
  }

  return (await res.json()) as GitHubEntry[];
}

function visibleDirectories(entries: GitHubEntry[]): GitHubEntry[] {
  return entries
    .filter((entry) => entry.type === "dir" && !entry.name.startsWith("."))
    .sort((a, b) => collator.compare(a.name, b.name));
}

function navigableDirectories(entries: GitHubEntry[]) {
  return visibleDirectories(entries).filter((entry) => entry.name !== "images");
}

export function pathSegmentSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function routeForPath(pathSegments: string[]): string {
  if (pathSegments.length === 0) {
    return "/articles";
  }

  return `/articles/${pathSegments.map(pathSegmentSlug).join("/")}`;
}

function routeValueMatches(name: string, value: string): boolean {
  const decoded = safeDecode(value);
  const slug = pathSegmentSlug(name);
  return name === value || name === decoded || slug === value || slug === decoded;
}

export async function getTopLevelEntries(
  opts?: FetchOptions
): Promise<GitHubEntry[]> {
  const data = await getDirectoryContents([], opts);
  return navigableDirectories(data);
}

export async function resolveArticleSegment(
  value: string,
  opts?: FetchOptions
): Promise<string | null> {
  const entries = await getTopLevelEntries(opts);
  const match = entries.find((entry) => routeValueMatches(entry.name, value));
  return match ? match.name : null;
}

export async function getArticleByPath(
  pathSegments: string[],
  opts?: FetchOptions
): Promise<Article | null> {
  const res = await fetch(contentsUrl(...pathSegments, "notes.md"), {
    headers: {
      ...headers(),
      Accept: "application/vnd.github.v3.raw",
    },
    ...fetchOptions(opts),
  });

  if (!res.ok) {
    return null;
  }

  const raw = await res.text();
  const fallbackTitle = pathSegments[pathSegments.length - 1] ?? "Untitled";
  const parsed = parseArticleDraft(raw, fallbackTitle);

  return {
    content: parsed.content,
    cover: parsed.cover,
    excerpt: parsed.excerpt,
    prerequisites: parsed.prerequisites,
    rawPath: rawUrl(...pathSegments),
    tags: parsed.tags,
    title: parsed.title,
  };
}

export async function getArticleTitle(
  filepath: string,
  opts?: FetchOptions
): Promise<string> {
  const normalizedPath = normalizePrerequisitePath(filepath);
  const parts = normalizedPath.split("/");
  const folderName = parts.length > 0 ? parts[parts.length - 1] : "Untitled";

  const res = await fetch(contentsUrl(...parts, "notes.md"), {
    headers: {
      ...headers(),
      Accept: "application/vnd.github.v3.raw",
    },
    ...fetchOptions(opts),
  });

  if (!res.ok) {
    return folderName;
  }

  const raw = await res.text();
  return parseArticleDraft(raw, folderName).title;
}

export function prerequisiteToRoute(filepath: string): string {
  const parts = normalizePrerequisitePath(filepath).split("/");
  return routeForPath(parts);
}

export async function listArticleSummaries(
  opts?: FetchOptions
): Promise<ArticleSummary[]> {
  const entries = await getTopLevelEntries(opts);
  const summaries = await Promise.all(
    entries.map(async (entry) => {
      const article = await getArticleByPath([entry.name], opts);
      if (!article) return null;
      return {
        slug: pathSegmentSlug(entry.name),
        title: article.title,
        excerpt: article.excerpt,
        coverUrl: article.cover
          ? rawUrl(entry.name, ...article.cover.split("/"))
          : null,
        tags: article.tags,
        pathSegments: [entry.name],
        href: routeForPath([entry.name]),
      } satisfies ArticleSummary;
    })
  );

  return summaries.filter((entry): entry is ArticleSummary => entry !== null);
}
