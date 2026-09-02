import "server-only";
import { cache } from "react";
import { imageSize } from "image-size";
import type { GalleryItem } from "@/components/ItemGallery";
import type { SiteGalleryItem } from "@/lib/items";
import { heroImageCandidates, parseRepoSlug, resolveImageUrl } from "@/lib/project-images-parse";
import { siteIconCandidates } from "@/lib/app-store-parse";

// The hero image is pulled from each project's own repo README (the first
// non-badge image), sized to its intrinsic dimensions so the salon wall can
// hang every project at its real aspect ratio. All of this is best-effort: any
// failure (private repo, no README, no image, unreadable dimensions) degrades
// to a typographic placard rather than breaking the page.

export type ProjectImage = { src: string; width: number; height: number };

const README_TTL = 3600; // 1h
// Matches the README window on purpose. What is cached here is not really the
// bytes but the *measurement* taken from them, and a stale measurement mis-sizes
// the panel it frames — a much worse failure than an extra hourly fetch.
const IMAGE_TTL = README_TTL;
// How many README image refs to probe before giving up and showing a placard.
const MAX_IMAGE_CANDIDATES = 4;

// Fallback aspect when an image is found but its dimensions can't be read.
export const DEFAULT_DIMS = { width: 1600, height: 1000 };

export function githubHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export type Readme = { markdown: string; downloadUrl: string };

/**
 * Memoised per render pass for the same reason as `loadProjectImage` below:
 * the gallery and the app store both read a repo's README in one request, and
 * neither should pin it across requests.
 */
export const fetchReadme = cache(async function fetchReadme(
  owner: string,
  repo: string,
): Promise<Readme | null> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
    headers: githubHeaders(),
    next: { revalidate: README_TTL },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: string; encoding?: string; download_url?: string };
  if (!data.download_url || typeof data.content !== "string") return null;
  const markdown =
    data.encoding === "base64" ? Buffer.from(data.content, "base64").toString("utf-8") : data.content;
  return { markdown, downloadUrl: data.download_url };
});

/** The README for whichever of an item's URLs names a GitHub repo. */
export function getReadme(repo?: string): Promise<Readme | null> {
  const slug = parseRepoSlug(repo);
  if (!slug) return Promise.resolve(null);
  return fetchReadme(slug.owner.toLowerCase(), slug.repo.toLowerCase());
}

// How much of an image is fetched to measure it. Every format keeps its size in
// the header — PNG, GIF and WebP within the first few dozen bytes, an SVG in
// its root tag, a JPEG in the first SOF marker — so the rest of the file is
// bandwidth spent on nothing. A JPEG carrying more EXIF than this falls back to
// the default aspect, which is the documented degradation for an unreadable
// image anyway.
const PROBE_BYTES = 32 * 1024;

/**
 * Probes a candidate image. The `exists` flag is deliberately separate from
 * `dims`: a 404 means "try the next candidate", but a 200 whose bytes we can't
 * measure is still a perfectly good image and should be hung at a default
 * aspect. Collapsing the two (as this used to) meant a dead URL was rendered
 * anyway with a guessed size — the broken frames on the wall.
 *
 * The request is a byte range, not the whole file. Besides the bandwidth, a
 * whole-file read of a large screenshot inside the page render overflowed the
 * dev server's response stream (React serialises awaited values into its
 * dev-only debug payload) and truncated the gallery on every cold start. A
 * server that ignores the range simply answers 200 with the full body, which
 * is measured the same way.
 */
export async function probeImage(
  url: string,
): Promise<{ exists: boolean; dims: { width: number; height: number } | null }> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Range: `bytes=0-${PROBE_BYTES - 1}` },
      next: { revalidate: IMAGE_TTL },
    });
  } catch {
    return { exists: false, dims: null };
  }
  if (!res.ok) return { exists: false, dims: null };
  try {
    const dims = imageSize(new Uint8Array(await res.arrayBuffer()));
    if (dims.width && dims.height) {
      return { exists: true, dims: { width: dims.width, height: dims.height } };
    }
  } catch {
    // Unreadable / unsupported format — it still loaded, so keep it.
  }
  return { exists: true, dims: null };
}

/**
 * Dedups concurrent and repeated lookups **within one render pass**.
 *
 * This must be `react/cache` and not a module-level Map: a Map lives as long as
 * the server process, so the first measurement a repo ever produced would be
 * pinned until the next deploy. That is not hypothetical — it is how `toji`
 * ended up framed at a stale 599x181 while GitHub served 1234x393, and since
 * the measured aspect is what sizes the panel, the panel cropped the art.
 * Reuse *across* requests is the fetch layer's job, where it can expire.
 */
const loadProjectImage = cache(async (owner: string, repo: string): Promise<ProjectImage | null> => {
  try {
    const readme = await fetchReadme(owner, repo);
    if (!readme) return null;
    // Bounded: a README with many images shouldn't cost many round-trips just
    // to find a hero. The real ones are always near the top.
    const refs = heroImageCandidates(readme.markdown).slice(0, MAX_IMAGE_CANDIDATES);
    for (const ref of refs) {
      const src = resolveImageUrl(ref, readme.downloadUrl);
      const { exists, dims } = await probeImage(src);
      if (!exists) continue;
      return { src, ...(dims ?? DEFAULT_DIMS) };
    }
    return null;
  } catch {
    return null;
  }
});

export function getProjectImage(repo?: string): Promise<ProjectImage | null> {
  const slug = parseRepoSlug(repo);
  if (!slug) return Promise.resolve(null);
  // GitHub treats owner/repo case-insensitively, so normalising here makes two
  // items that spell the same repo differently share one lookup.
  return loadProjectImage(slug.owner.toLowerCase(), slug.repo.toLowerCase());
}

/** Prefer the deployed site, then a generic link, then the repo itself. */
function destination(item: GalleryItem): string | undefined {
  return item.live || item.link || item.repo;
}

/** The GitHub repo can live in any of the URL fields; only a github URL parses. */
export function repoUrlFor(item: GalleryItem): string | undefined {
  return [item.repo, item.link, item.live].find((u) => parseRepoSlug(u));
}

/** A deployed site, if any of the URL fields point somewhere other than GitHub. */
export function siteUrlFor(item: GalleryItem): string | undefined {
  return [item.live, item.link].find((u) => u && /^https?:\/\//i.test(u) && !parseRepoSlug(u));
}

// A site's own HTML can be anything; only the head's <link> tags matter, and
// they are always near the top.
const SITE_HTML_CAP = 256 * 1024;

/**
 * The icon a site advertises for itself (apple-touch-icon first, then the
 * largest `rel=icon`). This is the fallback for a project whose only URL is a
 * deployed site — `thehifzproject.com` has no repo to scrape, but it does have
 * an app icon, and hanging a typographic placard for it was the wrong answer.
 */
const loadSiteIcon = cache(async (siteUrl: string): Promise<ProjectImage | null> => {
  try {
    const res = await fetch(siteUrl, {
      headers: { Accept: "text/html" },
      next: { revalidate: README_TTL },
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, SITE_HTML_CAP);
    for (const candidate of siteIconCandidates(html, res.url || siteUrl).slice(0, MAX_IMAGE_CANDIDATES)) {
      const { exists, dims } = await probeImage(candidate);
      if (!exists) continue;
      return { src: candidate, ...(dims ?? { width: 180, height: 180 }) };
    }
    return null;
  } catch {
    return null;
  }
});

export function getSiteIcon(siteUrl?: string): Promise<ProjectImage | null> {
  return siteUrl ? loadSiteIcon(siteUrl) : Promise.resolve(null);
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * Measures an explicitly chosen override image. Site-relative URLs (our own
 * `/api/uploads/:id`) need an absolute base before a server-side fetch will
 * resolve them. Dimensions here only matter for the automatic salon — the
 * hand-arranged wall carries its own stored box — so any failure falls back to
 * a default aspect rather than dropping the piece.
 */
async function measureOverride(url: string): Promise<ProjectImage> {
  const absolute = /^https?:\/\//.test(url) ? url : `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  // An override is an explicit choice, so it is kept even if the probe fails —
  // unlike a README candidate, there is nothing to fall through to.
  const { dims } = await probeImage(absolute);
  return { src: url, ...(dims ?? DEFAULT_DIMS) };
}

/**
 * The image a project hangs: an explicit override if one was chosen in the wall
 * editor (this is where an uploaded GIF lands), otherwise the README hero.
 */
export async function resolveProjectImage(
  item: GalleryItem & { wallImage?: string | null },
): Promise<ProjectImage | null> {
  const override = item.wallImage?.trim();
  if (override) return measureOverride(override);
  const fromRepo = await getProjectImage(repoUrlFor(item));
  if (fromRepo) return fromRepo;
  return getSiteIcon(siteUrlFor(item));
}

/** A project resolved for the hand-arranged wall: its art plus where it hangs. */
export type WallPieceData = {
  id: string;
  title: string;
  href?: string;
  src: string | null;
  /** Intrinsic dimensions, for seeding auto-arrange and the natural-aspect reset. */
  naturalWidth: number;
  naturalHeight: number;
};

/**
 * Resolves every project's art for the wall, independent of placement. The
 * editor pairs these with stored boxes (and auto-places anything unplaced);
 * the public wall does the same, so both see an identical piece list.
 */
export async function getProjectWallPieces(items: SiteGalleryItem[]): Promise<WallPieceData[]> {
  return Promise.all(
    items.map(async (item): Promise<WallPieceData> => {
      const image = await resolveProjectImage(item);
      return {
        id: item.id,
        title: item.title,
        href: destination(item),
        src: image?.src ?? null,
        naturalWidth: image?.width ?? DEFAULT_DIMS.width,
        naturalHeight: image?.height ?? DEFAULT_DIMS.height,
      };
    }),
  );
}
