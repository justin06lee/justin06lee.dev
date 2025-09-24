import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://justin06lee.dev";

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
		default: "justin06lee.dev",
		template: "%s | justin06lee.dev",
	},
	description: "projects, hobbies, and experiments by justin06lee",
	applicationName: "justin06lee.dev",
	generator: "Next.js",
	referrer: "origin-when-cross-origin",
	keywords: [
		"justin06lee",
		"portfolio",
		"projects",
		"hobbies",
		"software",
		"next.js",
		"react",
		"web dev",
	],
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
		images: [
			{ url: "/opengraph-image", width: 1200, height: 630, alt: "justin06lee.dev" },
		],
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
	icons: {
		icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
		shortcut: ["/icon.svg"],
		apple: ["/icon.svg"],
	},
	manifest: "/manifest.webmanifest",
};

// app/layout.tsx (Server Component)
export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)',  color: '#000000' },
  ],
  width: 'device-width',
  initialScale: 1,
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
