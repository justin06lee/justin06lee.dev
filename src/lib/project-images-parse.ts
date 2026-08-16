// Pure README/URL parsing for the project salon wall, split out from the
// server-only fetching code so the tricky regex + URL-resolution logic can be
// unit tested without a network or the `server-only` guard.

// Shields and CI badges are images too, but they aren't the hero. Skip them so
// a badge-led README doesn't hang a status pill on the wall.
export const BADGE_MARKERS = [
  "shields.io",
  "badgen.net",
  "badge.fury.io",
  "codecov.io",
  "circleci.com",
  "travis-ci",
  "/badge/",
  "/workflows/",
  "herokucdn.com",
  "vercel.com/button",
];

/** Extract `{ owner, repo }` from a GitHub repo URL or an `owner/repo` string. */
export function parseRepoSlug(repo?: string): { owner: string; repo: string } | null {
  if (!repo) return null;
  const cleaned = repo.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  const m =
    cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)/i) ??
    cleaned.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

export function isBadge(url: string): boolean {
  const lower = url.toLowerCase();
  return BADGE_MARKERS.some((m) => lower.includes(m));
}

/** Earliest non-badge image reference in the README, HTML `<img>` or markdown. */
export function firstHeroImage(markdown: string): string | null {
  const candidates: { index: number; url: string }[] = [];

  const htmlImg = /<img\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/gi;
  for (let m = htmlImg.exec(markdown); m; m = htmlImg.exec(markdown)) {
    candidates.push({ index: m.index, url: m[1] });
  }
  const mdImg = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)/g;
  for (let m = mdImg.exec(markdown); m; m = mdImg.exec(markdown)) {
    candidates.push({ index: m.index, url: m[1] });
  }

  candidates.sort((a, b) => a.index - b.index);
  const hero = candidates.find((c) => !isBadge(c.url));
  return hero?.url ?? null;
}

/** Resolve a README-relative image reference to an absolute raw URL. */
export function resolveImageUrl(ref: string, readmeDownloadUrl: string): string {
  if (/^https?:\/\//i.test(ref)) return ref;
  if (ref.startsWith("//")) return `https:${ref}`;

  const rootMatch = readmeDownloadUrl.match(
    /^(https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/)/,
  );
  if (ref.startsWith("/")) {
    return rootMatch ? rootMatch[1] + ref.slice(1) : ref;
  }
  const dir = readmeDownloadUrl.replace(/\/[^/]*$/, "/");
  try {
    return new URL(ref.replace(/^\.\//, ""), dir).href;
  } catch {
    return ref;
  }
}
