import type { Metadata } from "next";
// Both faces are self-hosted and pinned, never next/font/google: that re-fetches
// from Google at build time, so an upstream metrics change would silently shift
// the monospace glyph grid and break every ascii render (donut aspect, art
// alignment) on a new build. Poppins is the site's one typeface — every piece
// of UI text — shipped in the four weights the site uses so bold is a real cut,
// not a synthesised one. Geist Mono survives only where the glyph grid is the
// point: ascii art, the donut, and code. Exposes --font-poppins / --font-geist-mono.
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "@/components/theme-provider";
import { DialogProvider } from "@/components/Dialog";
import { Analytics } from "@vercel/analytics/next";

const poppins = localFont({
	src: [
		{ path: "../../public/Poppins-Regular.ttf", weight: "400", style: "normal" },
		{ path: "../../public/Poppins-Medium.ttf", weight: "500", style: "normal" },
		{ path: "../../public/Poppins-SemiBold.ttf", weight: "600", style: "normal" },
		{ path: "../../public/Poppins-Bold.ttf", weight: "700", style: "normal" },
	],
	variable: "--font-poppins",
	display: "swap",
});

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
			<body className={`${poppins.variable} ${GeistMono.variable} antialiased bg-black text-white`}>
				<ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
					<DialogProvider>
						{/* reducedMotion="user" makes every bespoke motion/react-client
						    animation (hero stagger, navbar/articles entrances) honor the OS
						    "reduce motion" setting; chrome components already self-guard.
						    MotionConfig is a client-only leaf, so rendering it here (a server
						    layout) is safe — it resolves to a client reference, not server code. */}
						<MotionConfig reducedMotion="user">
							{children}
							<Analytics />
						</MotionConfig>
					</DialogProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
