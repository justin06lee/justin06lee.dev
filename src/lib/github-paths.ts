export const ARTICLES_REPO_OWNER = "justin06lee";
export const ARTICLES_REPO_NAME = "articles.justin06lee.dev";
export const ARTICLES_REPO_BRANCH = "main";

const API_BASE = `https://api.github.com/repos/${ARTICLES_REPO_OWNER}/${ARTICLES_REPO_NAME}`;
const RAW_BASE = `https://raw.githubusercontent.com/${ARTICLES_REPO_OWNER}/${ARTICLES_REPO_NAME}/${ARTICLES_REPO_BRANCH}`;

export function assertSafeSegment(segment: string): void {
  if (!segment || segment === "." || segment === ".." || /[\\/]/.test(segment)) {
    throw new Error(`Invalid path segment: ${JSON.stringify(segment)}`);
  }
}

export function repoPath(...segments: string[]): string {
  return segments
    .map((segment) => {
      assertSafeSegment(segment);
      return encodeURIComponent(segment);
    })
    .join("/");
}

export function contentsUrl(...segments: string[]): string {
  const path = segments.length > 0 ? `/${repoPath(...segments)}` : "";
  return `${API_BASE}/contents${path}`;
}

export function rawUrl(...segments: string[]): string {
  const path = segments.length > 0 ? `/${repoPath(...segments)}` : "";
  return `${RAW_BASE}${path}`;
}
