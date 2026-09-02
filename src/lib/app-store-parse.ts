// Pure parsing for the app store listing (the "apps" hang in the projects
// gallery and the per-app page behind it). Split from the fetching code so the
// README slicing, screenshot picking and site-icon scraping can be unit tested
// without a network or the `server-only` guard.

import { isBadge } from "./project-images-parse";

/**
 * The README's opening — everything after the title and before the first
 * section heading — used as the app's long description.
 *
 * Presentational HTML (`<p align="center">`, `<img>`, `<a>` wrappers) and
 * image / badge lines are dropped rather than rendered: the intro is meant to
 * read as a description, and `prose` skips raw HTML anyway, so leaving those in
 * only produces blank lines where a banner used to be.
 */
export function readmeIntro(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");

  let start = 0;
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) inFence = !inFence;
    if (!inFence && /^#\s+\S/.test(lines[i])) {
      start = i + 1;
      break;
    }
  }

  let end = lines.length;
  inFence = false;
  for (let i = start; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) inFence = !inFence;
    if (!inFence && /^#{1,6}\s+\S/.test(lines[i])) {
      end = i;
      break;
    }
  }

  const body = lines
    .slice(start, end)
    .join("\n")
    // Markdown images, badge links, and any raw HTML.
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, "")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    // A line that was only a badge / link wrapper is now blank noise.
    .filter((line) => !/^\s*\[\s*\]\([^)]*\)\s*$/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return body;
}

/** A tag that names a version, as opposed to a branch someone tagged. */
export function isVersionTag(name: string): boolean {
  return /^v?\d+(\.\d+)*([-+.][0-9a-z]+)*$/i.test(name.trim());
}

const ICON_MARKER = /(^|[/\-_.])(icon|logo|appicon|favicon)([.\-_]|$)/i;
const RASTER_OR_VECTOR = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;

/**
 * Which README images are screenshots. The hero is excluded because it is the
 * icon (already shown), anything named like an icon or logo is excluded for the
 * same reason, and badges never were pictures of the app.
 */
export function pickScreenshots(candidates: string[], heroSrc: string | null, limit = 6): string[] {
  const out: string[] = [];
  for (const url of candidates) {
    if (out.length >= limit) break;
    if (url === heroSrc || isBadge(url)) continue;
    const path = url.split(/[?#]/)[0];
    if (ICON_MARKER.test(path.slice(path.lastIndexOf("/") + 1))) continue;
    if (!RASTER_OR_VECTOR.test(path)) continue;
    out.push(url);
  }
  return out;
}

/**
 * Icon URLs a site advertises for itself, best first: apple-touch-icons (the
 * app-icon-shaped ones), then `rel=icon` by declared size, largest first.
 * Anything under 64px is a favicon, not an icon, and is skipped.
 */
export function siteIconCandidates(html: string, pageUrl: string): string[] {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  const scored: { url: string; score: number }[] = [];
  for (const tag of links) {
    const rel = attr(tag, "rel")?.toLowerCase() ?? "";
    const href = attr(tag, "href");
    if (!href) continue;
    let score = 0;
    if (/apple-touch-icon/.test(rel)) score = 10_000 + (sizeOf(attr(tag, "sizes")) ?? 180);
    else if (/(^|\s)icon(\s|$)/.test(rel)) {
      const size = sizeOf(attr(tag, "sizes")) ?? (/\.ico$/i.test(href) ? 16 : 0);
      if (size < 64) continue;
      score = size;
    } else continue;
    const url = absolute(href, pageUrl);
    if (url) scored.push({ url, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  return scored.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true))).map((s) => s.url);
}

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

function sizeOf(sizes: string | undefined): number | null {
  const m = sizes?.match(/(\d+)x(\d+)/i);
  return m ? Math.max(Number(m[1]), Number(m[2])) : null;
}

function absolute(href: string, base: string): string | null {
  try {
    const url = new URL(href, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * What the app runs on, read off the tech tags. This is the "compatibility"
 * line and it deliberately says only what the tags say — never a guessed OS.
 */
export function platformsFor(tech: string[], hasSite: boolean): string[] {
  const tags = tech.map((t) => t.toLowerCase());
  const has = (re: RegExp) => tags.some((t) => re.test(t));
  const out: string[] = [];
  if (has(/tauri|electron|desktop/)) out.push("desktop");
  if (hasSite || has(/next\.?js|web|site|browser extension/)) out.push("web");
  if (has(/\bcli\b|terminal|tui/)) out.push("terminal");
  if (has(/agent skill|claude code/)) out.push("claude code");
  if (has(/library|\bapi\b/)) out.push("library");
  return out;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** `2026-08-19T00:00:00Z` as `aug 19, 2026`. UTC, so server and client agree. */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** The store's "open" target: the site if there is one, otherwise the code. */
export function openTarget(item: {
  live?: string | null;
  link?: string | null;
  repo?: string | null;
}): { href: string; kind: "site" | "source" } | null {
  const site = [item.live, item.link].find((u) => u && !isGithubUrl(u));
  if (site) return { href: site, kind: "site" };
  const code = [item.repo, item.link, item.live].find((u) => u && isGithubUrl(u));
  if (code) return { href: code, kind: "source" };
  const any = item.live || item.link || item.repo;
  return any ? { href: any, kind: "site" } : null;
}

export function isGithubUrl(url: string | null | undefined): boolean {
  return !!url && /^https?:\/\/(www\.)?github\.com\//i.test(url);
}

/** The first sentence-ish of a description, for the one-line store subtitle. */
export function shortSubtitle(description: string, max = 72): string {
  const text = description.trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = Math.max(cut.lastIndexOf(" — "), cut.lastIndexOf(", "), cut.lastIndexOf(". "), cut.lastIndexOf(" "));
  return `${cut.slice(0, at > 24 ? at : max).trim()}…`;
}
