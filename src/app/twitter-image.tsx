import { ImageResponse } from "next/og";

export const size = {
	width: 1200,
	height: 630,
};

export const contentType = "image/png";

export default function TwitterImage() {
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
					<div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2 }}>sehnsucht.dev</div>
				</div>
			</div>
		),
		size
	);
}


