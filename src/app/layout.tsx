import type { Metadata } from "next";
// Self-hosted, version-pinned via the `geist` package instead of next/font/google.
// next/font/google re-fetches the font from Google at build time, so an upstream
// metrics change silently shifts the monospace glyph grid and breaks every ascii
// render (donut aspect, art alignment) on any new build. Pinning the font in the
// lockfile makes builds reproducible. Exposes --font-geist-sans / --font-geist-mono.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { DialogProvider } from "@/components/Dialog";
import { Analytics } from "@vercel/analytics/next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://justin06lee.dev";

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		default: "justin06lee.dev",
		template: "%s | justin06lee.dev",
	},
	description: "projects, hobbies, and experiments by justin06lee",
	applicationName: "justin06lee.dev",
	generator: "Next.js",
	referrer: "origin-when-cross-origin",
	keywords: ["justin06lee", "portfolio", "projects", "hobbies", "software", "next.js", "react", "web dev"],
	authors: [{ name: "justin06lee" }],
	creator: "justin06lee",
	publisher: "justin06lee",
	category: "personal",
	alternates: { canonical: "/" },
	openGraph: {
		type: "website",
		locale: "en_US",
		url: SITE_URL,
		siteName: "justin06lee.dev",
		title: "justin06lee.dev",
		description: "projects, hobbies, and experiments by justin06lee",
		images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "justin06lee.dev" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "justin06lee",
		description: "projects, hobbies, and experiments by justin06lee",
		images: ["/twitter-image"],
	},
	robots: {
		index: true,
		follow: true,
		googleBot: { index: true, follow: true },
	},
	manifest: "/manifest.webmanifest",
};

// app/layout.tsx (Server Component)
export const viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#ffffff" },
		{ media: "(prefers-color-scheme: dark)", color: "#000000" },
	],
	width: "device-width",
	initialScale: 1,
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning className="bg-black">
			<body className={`${GeistSans.variable} ${GeistMono.variable} antialiased bg-black text-white`}>
				<ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
					<DialogProvider>
						{children}
						<Analytics />
					</DialogProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
