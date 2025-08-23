import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sehnsucht.dev";
    return {
        rules: [{ userAgent: "*", allow: "/" }],
        sitemap: `${base}/sitemap.xml`,
        host: new URL(base).host,
    };
}