import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sehnsucht.dev";
    const lastModified = new Date();
    return [
        { url: `${base}/`, lastModified, changeFrequency: "weekly", priority: 1 },
        { url: `${base}/hobbies`, lastModified, changeFrequency: "weekly", priority: 0.7 },
        { url: `${base}/projects`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    ];
}