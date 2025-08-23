import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sehnsucht.dev";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		default: "sehnsucht.dev",
		template: "%s | sehnsucht.dev",
	},
	description: "projects, hobbies, and experiments by sehnsucht",
	applicationName: "sehnsucht.dev",
	generator: "Next.js",
	referrer: "origin-when-cross-origin",
	keywords: [
		"sehnsucht",
		"portfolio",
		"projects",
		"hobbies",
		"software",
		"next.js",
		"react",
		"web dev",
	],
	authors: [{ name: "sehnsucht" }],
	creator: "sehnsucht",
	publisher: "sehnsucht",
	category: "personal",
	alternates: { canonical: "/" },
	openGraph: {
		type: "website",
		locale: "en_US",
		url: SITE_URL,
		siteName: "sehnsucht.dev",
		title: "sehnsucht.dev",
		description: "projects, hobbies, and experiments by sehnsucht",
		images: [
			{ url: "/opengraph-image", width: 1200, height: 630, alt: "sehnsucht.dev" },
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "sehnsucht.dev",
		description: "projects, hobbies, and experiments by sehnsucht",
		images: ["/twitter-image"],
	},
	robots: {
		index: true,
		follow: true,
		googleBot: { index: true, follow: true },
	},
	icons: {
		icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
		shortcut: ["/icon.svg"],
		apple: ["/icon.svg"],
	},
	manifest: "/manifest.webmanifest",
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#ffffff" },
		{ media: "(prefers-color-scheme: dark)", color: "#000000" },
	],
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white`}
			>
				<ThemeProvider
					attribute="class"
					defaultTheme="dark"
					enableSystem
					disableTransitionOnChange
				>
					{children}
				</ThemeProvider>
			</body>
		</html>
	);
}
