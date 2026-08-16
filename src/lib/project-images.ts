import "server-only";
import { imageSize } from "image-size";
import type { GalleryItem } from "@/components/ItemGallery";
import type { SalonItem } from "@/components/chrome/salon";
import { firstHeroImage, parseRepoSlug, resolveImageUrl } from "@/lib/project-images-parse";

// The hero image is pulled from each project's own repo README (the first
// non-badge image), sized to its intrinsic dimensions so the salon wall can
// hang every project at its real aspect ratio. All of this is best-effort: any
// failure (private repo, no README, no image, unreadable dimensions) degrades
// to a typographic placard rather than breaking the page.

export type ProjectImage = { src: string; width: number; height: number };

const README_TTL = 3600; // 1h
const IMAGE_TTL = 86400; // 1d — image bytes change far less often than a README

// Fallback aspect when an image is found but its dimensions can't be read.
const DEFAULT_DIMS = { width: 1600, height: 1000 };

function githubHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function fetchReadme(
  owner: string,
  repo: string,
): Promise<{ markdown: string; downloadUrl: string } | null> {
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
}

async function readDimensions(url: string): Promise<{ width: number; height: number } | null> {
  const res = await fetch(url, { next: { revalidate: IMAGE_TTL } });
  if (!res.ok) return null;
  try {
    const dims = imageSize(new Uint8Array(await res.arrayBuffer()));
    if (dims.width && dims.height) return { width: dims.width, height: dims.height };
  } catch {
    // unreadable / unsupported format — caller falls back to a default aspect
  }
  return null;
}

// Dedup concurrent and repeated lookups within a render pass; the fetch-layer
// revalidate cache handles reuse across requests.
const inFlight = new Map<string, Promise<ProjectImage | null>>();

export function getProjectImage(repo?: string): Promise<ProjectImage | null> {
  const slug = parseRepoSlug(repo);
  if (!slug) return Promise.resolve(null);
  const key = `${slug.owner}/${slug.repo}`.toLowerCase();
  const existing = inFlight.get(key);
  if (existing) return existing;

  const task = (async (): Promise<ProjectImage | null> => {
    try {
      const readme = await fetchReadme(slug.owner, slug.repo);
      if (!readme) return null;
      const ref = firstHeroImage(readme.markdown);
      if (!ref) return null;
      const src = resolveImageUrl(ref, readme.downloadUrl);
      const dims = (await readDimensions(src)) ?? DEFAULT_DIMS;
      return { src, width: dims.width, height: dims.height };
    } catch {
      return null;
    }
  })();

  inFlight.set(key, task);
  return task;
}

/** Prefer the deployed site, then a generic link, then the repo itself. */
function destination(item: GalleryItem): string | undefined {
  return item.live || item.link || item.repo;
}

/** Map gallery items to salon pieces, hanging each project's README hero image. */
export async function getProjectSalonItems(items: GalleryItem[]): Promise<SalonItem[]> {
  return Promise.all(
    items.map(async (item): Promise<SalonItem> => {
      const image = await getProjectImage(item.repo);
      const href = destination(item);
      if (!image) {
        // No hero image: a placard keeps the project on the wall.
        return { width: 1200, height: 900, href, external: true, title: item.title, alt: item.title };
      }
      return {
        src: image.src,
        width: image.width,
        height: image.height,
        href,
        external: true,
        title: item.title,
        alt: item.title,
      };
    }),
  );
}
