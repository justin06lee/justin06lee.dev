import "server-only";
import { cache } from "react";
import { githubHeaders } from "@/lib/project-images";
import { parseRepoSlug } from "@/lib/project-images-parse";

/**
 * Where a project keeps the clip its channel plays on the CRT. A fixed path
 * rather than something read out of the README: a README can't embed a
 * repo-relative video, and a convention is what lets a new project be picked
 * up by dropping one file in place (see docs/crt-project-prompt.md).
 */
export const CRT_VIDEO_PATH = "assets/crt.mp4";
const VIDEO_TTL = 3600; // 1h, the README's window

/**
 * The raw URL of a project's CRT clip, or null when the repo has none. Asked
 * of the Contents API rather than built as a raw URL, since that would need
 * the default branch, and the API answers with the right one. Memoised per
 * render pass with cache() for the same reason as the README: a module-level
 * Map would pin the first answer until the next deploy, and a project that
 * adds a clip later would never get it.
 */
const loadProjectVideo = cache(async (owner: string, repo: string): Promise<string | null> => {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${CRT_VIDEO_PATH}`, {
      headers: githubHeaders(),
      next: { revalidate: VIDEO_TTL },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { download_url?: string | null; type?: string };
    return data.type === "file" && data.download_url ? data.download_url : null;
  } catch {
    return null;
  }
});

/** The clip for whichever of an item's URLs names a GitHub repo. */
export function getProjectVideo(repoUrl?: string): Promise<string | null> {
  const slug = parseRepoSlug(repoUrl);
  if (!slug) return Promise.resolve(null);
  return loadProjectVideo(slug.owner.toLowerCase(), slug.repo.toLowerCase());
}
