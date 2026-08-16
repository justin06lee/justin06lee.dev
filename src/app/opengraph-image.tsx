import { readFile } from "fs/promises";
import { join } from "path";
import { ImageResponse } from "next/og";

export const size = {
	width: 1200,
	height: 630,
};

export const contentType = "image/png";

export default async function OGImage() {
	// Load the real Poppins face so the fontFamily declaration below is honored
	// by Satori (without a fonts buffer it silently falls back to its default).
	const poppins = await readFile(
		join(process.cwd(), "public", "Poppins-Regular.ttf")
	);

	return new ImageResponse(
		(
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background: "#0b0b0b",
					color: "#ffffff",
					fontFamily: "Poppins, system-ui, sans-serif",
				}}
			>
				<div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
					<div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2 }}>justin06lee.dev</div>
				</div>
			</div>
		),
		{
			...size,
			fonts: [{ name: "Poppins", data: poppins, style: "normal" }],
		}
	);
}
