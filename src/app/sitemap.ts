import type { MetadataRoute } from "next";
import { listArticleSummaries } from "@/lib/github";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://justin06lee.dev";

    // Only public surfaces belong here — /me and /desk are admin, /oddjobs is an
    // empty placeholder, and /calendar/* is dynamic/admin-driven.
    const staticRoutes: MetadataRoute.Sitemap = [
        { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
        { url: `${base}/articles`, changeFrequency: "weekly", priority: 0.8 },
        { url: `${base}/gallery`, changeFrequency: "weekly", priority: 0.7 },
        { url: `${base}/cat`, changeFrequency: "monthly", priority: 0.5 },
    ];

    let articleRoutes: MetadataRoute.Sitemap = [];
    try {
        const summaries = await listArticleSummaries();
        articleRoutes = summaries
            .filter((summary) => !summary.hidden)
            // ArticleSummary carries no modification timestamp, so lastModified is
            // omitted rather than faked with new Date().
            .map((summary) => ({
                url: `${base}/articles/${summary.slug}`,
                changeFrequency: "monthly" as const,
                priority: 0.6,
            }));
    } catch {
        // A throwing sitemap breaks the route entirely; degrade to static routes
        // when the GitHub listing is unavailable.
        articleRoutes = [];
    }

    return [...staticRoutes, ...articleRoutes];
}
