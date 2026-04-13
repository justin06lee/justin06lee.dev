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
		icons: [
			{
				src: "/justin06leefav.png",
				sizes: "any",
				type: "image/png",
				purpose: "any",
			},
		],
	};
}


