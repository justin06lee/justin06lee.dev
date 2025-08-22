"use client";
import React, { useEffect, useRef } from "react";

export type AsciiSpinningDonutProps = {
	// Canvas size in characters
	width?: number;           // default 60
	height?: number;          // default 30

	// Torus geometry
	R?: number;               // major radius (default 0.2)
	r?: number;               // minor radius (default 0.125)

	// Projection params
	K?: number;               // scale (default 120)
	D?: number;               // camera distance (default 3.5)

	// Sampling steps (smaller = more detail)
	du?: number;              // around the donut (default 0.07)
	dv?: number;              // around the tube  (default 0.02)

	// Shading
	luminanceChars?: string;  // default " ,-~:;=!*#$@"
	lightDirection?: [number, number, number]; // default [0, 1, -1]

	// Animation
	speed?: number;           // default 0.75
	className?: string;       // extra classes for <pre>
};

export default function AsciiSpinningDonut({
	width = 60,
	height = 30,
	R = 0.2,
	r = 0.125,
	K = 120,
	D = 3.5,
	du = 0.07,
	dv = 0.02,
	luminanceChars = " ,-~:;=!*#$@",
	lightDirection = [0, 1, -1],
	speed = 0.75,
	className = "font-mono text-xs whitespace-pre cursor-default select-none",
}: AsciiSpinningDonutProps) {
	const preRef = useRef<HTMLPreElement | null>(null);

	useEffect(() => {
		let rafId = 0;

		// Animation angles
		let ax = 0; // rotation around X
		let az = 0; // rotation around Z

		// ---- helpers (scoped to effect) ----
		function normalize(v: number[]) {
			const m = Math.hypot(v[0], v[1], v[2]) || 1;
			return [v[0] / m, v[1] / m, v[2] / m];
		}
		function rotateX(v: number[], a: number) {
			const [x, y, z] = v;
			const ca = Math.cos(a), sa = Math.sin(a);
			return [x, y * ca - z * sa, y * sa + z * ca];
		}
		function rotateZ(v: number[], a: number) {
			const [x, y, z] = v;
			const ca = Math.cos(a), sa = Math.sin(a);
			return [x * ca - y * sa, x * sa + y * ca, z];
		}
		function dot(a: number[], b: number[]) {
			return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
		}

		const L = normalize(lightDirection);
		const chars = luminanceChars.length ? luminanceChars : " ";

		function frame() {
			ax += 0.025 * speed;
			az += 0.015 * speed;

			const zbuf = new Float32Array(width * height);
			zbuf.fill(-Infinity);
			const out: string[] = Array(width * height).fill(" ");

			for (let u = 0; u < Math.PI * 2; u += du) {
				const cu = Math.cos(u), su = Math.sin(u);

				for (let v = 0; v < Math.PI * 2; v += dv) {
					const cv = Math.cos(v), sv = Math.sin(v);

					// Point on torus (before rotation)
					const px = (R + r * cv) * cu;
					const py = (R + r * cv) * su;
					const pz = r * sv;

					// Normal (before rotation)
					const nx = cv * cu;
					const ny = cv * su;
					const nz = sv;

					// Rotate
					let p = rotateX([px, py, pz], ax);
					p = rotateZ(p, az);
					let n = rotateX([nx, ny, nz], ax);
					n = rotateZ(n, az);

					// Projection
					const z = p[2] + D;
					const ooz = 1 / z;
					const xProj = Math.floor(width / 2 + (K * p[0]) * ooz);
					const yProj = Math.floor(height / 2 - (K * p[1]) * ooz);

					if (xProj >= 0 && xProj < width && yProj >= 0 && yProj < height) {
						const idx = xProj + yProj * width;
						if (ooz > zbuf[idx]) {
							zbuf[idx] = ooz;

							// Lambert lighting
							const lum = Math.max(0, dot(normalize(n), L));
							const ci = Math.min(chars.length - 1, Math.floor(lum * (chars.length - 1)));
							out[idx] = chars[ci];
						}
					}
				}
			}

			// Write to <pre>
			const lines: string[] = [];
			for (let y = 0; y < height; y++) {
				const start = y * width;
				lines.push(out.slice(start, start + width).join(""));
			}
			if (preRef.current) preRef.current.textContent = lines.join("\n");

			rafId = requestAnimationFrame(frame);
		}

		rafId = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(rafId);
		// Recompute when any setting changes
	}, [
		width,
		height,
		R,
		r,
		K,
		D,
		du,
		dv,
		luminanceChars,
		speed,
		lightDirection[0],
		lightDirection[1],
		lightDirection[2],
	]);

	return (
		<pre
			ref={preRef}
			className={className}
			aria-label="ASCII donut output"
		/>
	);
}
