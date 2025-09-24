"use client";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

export type AsciiSpinningDonutProps = {
	width?: number;
	height?: number;
	R?: number;
	r?: number;
	K?: number;
	D?: number;
	du?: number;
	dv?: number;
	luminanceChars?: string;
	lightDirection?: [number, number, number];
	speed?: number;
	yScaleOverride?: number;
	className?: string;
};

export default function AsciiSpinningDonut({
	width = 60,
	height = 30,
	R = 0.4,
	r = 0.25,
	K = 120,
	D = 4,
	du = 0.035,
	dv = 0.01,
	luminanceChars = " ,-~:;=!*#$@",
	lightDirection = [0, 1, -1],
	speed = 0.75,
	yScaleOverride,
	className = "font-mono text-xs leading-[1] whitespace-pre cursor-default select-none",
}: AsciiSpinningDonutProps) {
	const preRef = useRef<HTMLPreElement | null>(null);

	const [yScale, setYScale] = useState<number>(yScaleOverride ?? 0.55);

	useLayoutEffect(() => {
		if (yScaleOverride != null || !preRef.current) return;
		const pre = preRef.current;

		const probe = document.createElement("span");
		probe.textContent = "0";
		probe.style.position = "absolute";
		probe.style.visibility = "hidden";
		pre.appendChild(probe);

		const charWidth = probe.getBoundingClientRect().width || 1;
		let lineHeight = parseFloat(getComputedStyle(pre).lineHeight);
		if (!isFinite(lineHeight) || lineHeight <= 0) {
			const twoLines = document.createElement("div");
			twoLines.style.position = "absolute";
			twoLines.style.visibility = "hidden";
			twoLines.style.whiteSpace = "pre";
			twoLines.textContent = "0\n0";
			pre.appendChild(twoLines);
			lineHeight = twoLines.getBoundingClientRect().height / 2 || 1;
			pre.removeChild(twoLines);
		}

		pre.removeChild(probe);
		setYScale(charWidth / lineHeight);
	}, [className, yScaleOverride]);

	useEffect(() => {
		let rafId = 0;

		let ax = 0;
		let az = 0;

		const normalize = (v: number[]) => {
			const m = Math.hypot(v[0], v[1], v[2]) || 1;
			return [v[0] / m, v[1] / m, v[2] / m];
		};
		const rotateX = (v: number[], a: number) => {
			const [x, y, z] = v;
			const ca = Math.cos(a), sa = Math.sin(a);
			return [x, y * ca - z * sa, y * sa + z * ca];
		};
		const rotateZ = (v: number[], a: number) => {
			const [x, y, z] = v;
			const ca = Math.cos(a), sa = Math.sin(a);
			return [x * ca - y * sa, x * sa + y * ca, z];
		};
		const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

		const L = normalize(lightDirection);
		const chars = luminanceChars.length ? luminanceChars : " ";

		const cx = Math.floor(width / 2);
		const cy = Math.floor(height / 2);

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

					const px = (R + r * cv) * cu;
					const py = (R + r * cv) * su;
					const pz = r * sv;

					const nx = cv * cu;
					const ny = cv * su;
					const nz = sv;

					let p = rotateX([px, py, pz], ax);
					p = rotateZ(p, az);
					let n = rotateX([nx, ny, nz], ax);
					n = rotateZ(n, az);

					const z = p[2] + D;
					const ooz = 1 / z;
					const xProj = Math.floor(cx + (K * p[0]) * ooz);
					const yProj = Math.floor(cy - (K * p[1]) * ooz * yScale);

					if (xProj >= 0 && xProj < width && yProj >= 0 && yProj < height) {
						const idx = xProj + yProj * width;
						if (ooz > zbuf[idx]) {
							zbuf[idx] = ooz;

							const lum = Math.max(0, dot(normalize(n), L));
							const ci = Math.min(chars.length - 1, Math.floor(lum * (chars.length - 1)));
							out[idx] = chars[ci];
						}
					}
				}
			}

			if (preRef.current) {
				const lines: string[] = [];
				for (let y = 0; y < height; y++) {
					const start = y * width;
					lines.push(out.slice(start, start + width).join(""));
				}
				preRef.current.textContent = lines.join("\n");
			}

			rafId = requestAnimationFrame(frame);
		}

		rafId = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(rafId);
	}, [
		width, height, R, r, K, D, du, dv, luminanceChars, speed,
		lightDirection[0], lightDirection[1], lightDirection[2],
		yScale
	]);

	return (
		<pre
			ref={preRef}
			className={className}
			aria-label="ASCII donut output"
		/>
	);
}
