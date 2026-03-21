import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://justin06lee.dev";
    return {
        rules: [{ userAgent: "*", allow: "/", disallow: ["/me", "/api/"] }],
        sitemap: `${base}/sitemap.xml`,
        host: new URL(base).host,
    };
}