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

/**
 * Every non-badge image reference in the README, in document order and
 * de-duplicated.
 *
 * Callers try these in order and skip any that 404: a README routinely outlives
 * the asset it points at (a renamed cover, a moved `assets/` dir), and using a
 * dead URL anyway hangs a broken image on the wall. Falling through to the next
 * candidate recovers a repo that has a working image further down.
 */
export function heroImageCandidates(markdown: string): string[] {
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

  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    if (isBadge(c.url) || seen.has(c.url)) continue;
    seen.add(c.url);
    out.push(c.url);
  }
  return out;
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
