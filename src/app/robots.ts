import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://justin06lee.dev";
    return {
        // /calendar stays crawlable — it is linked in the public nav. /me and
        // /desk are auth-gated admin surfaces (crawlers only see a login form),
        // /api/ is not a document surface.
        rules: [{ userAgent: "*", allow: "/", disallow: ["/me", "/desk", "/api/"] }],
        sitemap: `${base}/sitemap.xml`,
        host: new URL(base).host,
    };
}