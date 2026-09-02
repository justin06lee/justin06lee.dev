import "server-only";
import { cache } from "react";
import type { SiteGalleryItem } from "@/lib/items";
import {
  DEFAULT_DIMS,
  getReadme,
  githubHeaders,
  probeImage,
  repoUrlFor,
  resolveProjectImage,
  siteUrlFor,
  type ProjectImage,
} from "@/lib/project-images";
import { heroImageCandidates, parseRepoSlug, resolveImageUrl } from "@/lib/project-images-parse";
import {
  formatDate,
  isVersionTag,
  openTarget,
  pickScreenshots,
  platformsFor,
  readmeIntro,
  shortSubtitle,
} from "@/lib/app-store-parse";

// The app store reads everything it shows off the project's own repo — the
// README for screenshots and the long description, GitHub releases for "what's
// new", the repo record for the information block. Nothing is stored twice:
// add a screenshot to the README and it appears here, cut a release and the
// notes appear here. All of it is best-effort and degrades to the item row.

const TTL = 3600;

export type Screenshot = ProjectImage;

export type AppCard = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: ProjectImage | null;
  screenshots: Screenshot[];
  /** Where "open" goes, and whether that is the site or the source. */
  open: { href: string; kind: "site" | "source" } | null;
  href: string;
  tech: string[];
};

export type Release = {
  version: string;
  name: string | null;
  date: string | null;
  notes: string | null;
};

export type AppListing = AppCard & {
  year: number;
  repoUrl: string | null;
  siteUrl: string | null;
  /** The README's opening, as markdown, and the base its relative links resolve against. */
  about: { markdown: string; imageBaseUrl: string | null } | null;
  releases: Release[];
  info: {
    developer: string;
    language: string | null;
    license: string | null;
    stars: number | null;
    updated: string | null;
    platforms: string[];
    topics: string[];
  };
};

type RepoRecord = {
  description: string | null;
  homepage: string | null;
  language: string | null;
  license: { spdx_id?: string | null } | null;
  stargazers_count: number;
  pushed_at: string;
  topics?: string[];
  owner?: { login?: string };
};

type ReleaseRecord = {
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
};

async function github<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: githubHeaders(),
      next: { revalidate: TTL },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const loadRepo = cache((owner: string, repo: string) => github<RepoRecord>(`/repos/${owner}/${repo}`));

/**
 * Releases carry notes; when a repo only tags versions there is still a
 * history worth listing, just without dates or notes. Branch-style tags
 * (`feat/…`) are not versions and are left out.
 */
const loadReleases = cache(async (owner: string, repo: string): Promise<Release[]> => {
  const releases = await github<ReleaseRecord[]>(`/repos/${owner}/${repo}/releases?per_page=10`);
  const published = (releases ?? []).filter((r) => !r.draft && !r.prerelease);
  if (published.length > 0) {
    return published.map((r) => ({
      version: r.tag_name,
      name: r.name && r.name !== r.tag_name ? r.name : null,
      date: r.published_at,
      notes: r.body?.trim() || null,
    }));
  }
  const tags = await github<{ name: string }[]>(`/repos/${owner}/${repo}/tags?per_page=10`);
  return (tags ?? [])
    .filter((t) => isVersionTag(t.name))
    .map((t) => ({ version: t.name, name: null, date: null, notes: null }));
});

/** README images that are pictures of the app, measured so the shelf can frame them. */
const loadScreenshots = cache(async (repoUrl: string, heroSrc: string | null): Promise<Screenshot[]> => {
  const readme = await getReadme(repoUrl);
  if (!readme) return [];
  const urls = pickScreenshots(
    heroImageCandidates(readme.markdown).map((ref) => resolveImageUrl(ref, readme.downloadUrl)),
    heroSrc,
  );
  const probed = await Promise.all(
    urls.map(async (src) => {
      const { exists, dims } = await probeImage(src);
      return exists ? { src, ...(dims ?? DEFAULT_DIMS) } : null;
    }),
  );
  return probed.filter((s): s is Screenshot => s !== null);
});

export async function getAppCard(item: SiteGalleryItem, icon?: ProjectImage | null): Promise<AppCard> {
  const resolvedIcon = icon === undefined ? await resolveProjectImage(item) : icon;
  const repoUrl = repoUrlFor(item);
  const screenshots = repoUrl ? await loadScreenshots(repoUrl, resolvedIcon?.src ?? null) : [];
  return {
    id: item.id,
    title: item.title,
    subtitle: shortSubtitle(item.description),
    description: item.description,
    icon: resolvedIcon,
    screenshots,
    open: openTarget(item),
    href: `/apps/${encodeURIComponent(item.id)}`,
    tech: item.tech,
  };
}

export async function getAppListing(item: SiteGalleryItem): Promise<AppListing> {
  const card = await getAppCard(item);
  const repoUrl = repoUrlFor(item) ?? null;
  const slug = parseRepoSlug(repoUrl ?? undefined);
  const owner = slug?.owner.toLowerCase();
  const repo = slug?.repo.toLowerCase();

  const [record, releases, readme] = await Promise.all([
    owner && repo ? loadRepo(owner, repo) : null,
    owner && repo ? loadReleases(owner, repo) : [],
    repoUrl ? getReadme(repoUrl) : null,
  ]);

  const intro = readme ? readmeIntro(readme.markdown) : "";
  const siteUrl = siteUrlFor(item) ?? (record?.homepage && !parseRepoSlug(record.homepage) ? record.homepage : null);

  return {
    ...card,
    year: item.year,
    repoUrl,
    siteUrl: siteUrl ?? null,
    about: intro
      ? { markdown: intro, imageBaseUrl: readme ? readme.downloadUrl.replace(/\/[^/]*$/, "") : null }
      : null,
    releases,
    info: {
      developer: slug?.owner ?? "justin06lee",
      language: record?.language ?? null,
      license: record?.license?.spdx_id && record.license.spdx_id !== "NOASSERTION" ? record.license.spdx_id : null,
      stars: record?.stargazers_count ?? null,
      updated: formatDate(record?.pushed_at),
      platforms: platformsFor(item.tech, !!siteUrl),
      topics: record?.topics ?? [],
    },
  };
}
