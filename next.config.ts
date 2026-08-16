import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No `images` block on purpose: the app uses raw <img> everywhere (zero
  // next/image usages), so the image-optimizer stays off. A remotePatterns
  // entry here would turn /_next/image into an open proxy for the allowed host.
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
    // Keep prefetched dynamic routes (the force-dynamic calendar pages) in the
    // client router cache briefly, so a full <Link prefetch> warms the data and
    // clicking an adjacent period navigates instantly instead of refetching.
    // Short window so the admin's own edits still surface quickly on revisit.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  serverExternalPackages: [
    "@libsql/client",
    "@libsql/hrana-client",
    "@libsql/isomorphic-ws",
    "@libsql/isomorphic-fetch",
    "libsql",
  ],
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Content-Security-Policy",
          value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://vitals.vercel-insights.com https://raw.githubusercontent.com; frame-ancestors 'none';",
        },
        // `self` must be a bare token; the quoted "self" is invalid
        // structured-field syntax and silently disables geolocation entirely,
        // breaking the /me prayer-location picker.
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
      ],
    },
  ],
};

export default nextConfig;
