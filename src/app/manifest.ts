import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "justin06lee.dev",
		short_name: "justin06lee",
		description: "projects, hobbies, and experiments by justin06lee",
		start_url: "/",
		scope: "/",
		display: "standalone",
		background_color: "#000000",
		theme_color: "#000000",
		// Sizes reflect the real source PNGs: icon.png is 480x480 (served at
		// /icon), apple-icon.png is 180x180 (served at /apple-icon).
		icons: [
			{
				src: "/icon",
				sizes: "480x480",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/icon",
				sizes: "480x480",
				type: "image/png",
				purpose: "maskable",
			},
			{
				src: "/apple-icon",
				sizes: "180x180",
				type: "image/png",
				purpose: "any",
			},
		],
	};
}


