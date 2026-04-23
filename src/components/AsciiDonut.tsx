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

	// Memoize lightDirection to avoid dependency issues
	const lx = lightDirection[0];
	const ly = lightDirection[1];
	const lz = lightDirection[2];

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
	}, [yScaleOverride]);

	useEffect(() => {
		let rafId = 0;
		let ax = 0;
		let az = 0;

		// Detect low-end device: <=4 logical cores or deviceMemory <= 4GB
		const cores = navigator.hardwareConcurrency || 2;
		const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
		const isLowEnd = cores <= 4 || memory <= 4;

		// Adaptive step sizes — coarser on low-end
		const adaptiveDu = isLowEnd ? Math.max(du, 0.07) : du;
		const adaptiveDv = isLowEnd ? Math.max(dv, 0.02) : dv;

		// Throttle to ~30fps on low-end, ~60fps otherwise
		const frameBudget = isLowEnd ? 33 : 0;
		let lastFrameTime = 0;

		const lMag = Math.hypot(lx, ly, lz) || 1;
		const Lx = lx / lMag;
		const Ly = ly / lMag;
		const Lz = lz / lMag;

		const chars = luminanceChars.length ? luminanceChars : " ";
		const charsLen = chars.length;
		const cx = width >> 1;
		const cy = height >> 1;
		const bufSize = width * height;

		// Pre-allocate buffers once
		const zbuf = new Float32Array(bufSize);
		const outBuf = new Uint8Array(bufSize); // index into chars
		const spaceIdx = 0; // chars[0] is space

		// Pre-compute trig tables for u and v
		const uSteps = Math.ceil((Math.PI * 2) / adaptiveDu);
		const vSteps = Math.ceil((Math.PI * 2) / adaptiveDv);
		const cosU = new Float32Array(uSteps);
		const sinU = new Float32Array(uSteps);
		const cosV = new Float32Array(vSteps);
		const sinV = new Float32Array(vSteps);

		for (let i = 0; i < uSteps; i++) {
			const u = i * adaptiveDu;
			cosU[i] = Math.cos(u);
			sinU[i] = Math.sin(u);
		}
		for (let i = 0; i < vSteps; i++) {
			const v = i * adaptiveDv;
			cosV[i] = Math.cos(v);
			sinV[i] = Math.sin(v);
		}

		function frame(now: number) {
			if (frameBudget > 0 && now - lastFrameTime < frameBudget) {
				rafId = requestAnimationFrame(frame);
				return;
			}
			lastFrameTime = now;

			ax += 0.025 * speed;
			az += 0.015 * speed;

			// Reset buffers
			zbuf.fill(-Infinity);
			outBuf.fill(spaceIdx);

			const cosAx = Math.cos(ax), sinAx = Math.sin(ax);
			const cosAz = Math.cos(az), sinAz = Math.sin(az);

			for (let ui = 0; ui < uSteps; ui++) {
				const cu = cosU[ui], su = sinU[ui];

				for (let vi = 0; vi < vSteps; vi++) {
					const cv = cosV[vi], sv = sinV[vi];

					// Torus point
					const Rcv = R + r * cv;
					const px0 = Rcv * cu;
					const py0 = Rcv * su;
					const pz0 = r * sv;

					// Normal
					const nx0 = cv * cu;
					const ny0 = cv * su;
					const nz0 = sv;

					// Rotate X then Z (inlined)
					const px1 = px0;
					const py1 = py0 * cosAx - pz0 * sinAx;
					const pz1 = py0 * sinAx + pz0 * cosAx;
					const px2 = px1 * cosAz - py1 * sinAz;
					const py2 = px1 * sinAz + py1 * cosAz;
					const pz2 = pz1;

					const nx1 = nx0;
					const ny1 = ny0 * cosAx - nz0 * sinAx;
					const nz1 = ny0 * sinAx + nz0 * cosAx;
					const nx2 = nx1 * cosAz - ny1 * sinAz;
					const ny2 = nx1 * sinAz + ny1 * cosAz;
					const nz2 = nz1;

					const z = pz2 + D;
					if (z <= 0) continue;
					const ooz = 1 / z;

					const xProj = (cx + (K * px2) * ooz) | 0;
					const yProj = (cy - (K * py2) * ooz * yScale) | 0;

					if (xProj >= 0 && xProj < width && yProj >= 0 && yProj < height) {
						const idx = xProj + yProj * width;
						if (ooz > zbuf[idx]) {
							zbuf[idx] = ooz;

							// Normalize n inline
							const nMag = Math.hypot(nx2, ny2, nz2) || 1;
							const lum = Math.max(0, (nx2 / nMag) * Lx + (ny2 / nMag) * Ly + (nz2 / nMag) * Lz);
							outBuf[idx] = Math.min(charsLen - 1, (lum * (charsLen - 1)) | 0);
						}
					}
				}
			}

			if (preRef.current) {
				let str = "";
				for (let y = 0; y < height; y++) {
					const start = y * width;
					for (let x = 0; x < width; x++) {
						str += chars[outBuf[start + x]];
					}
					if (y < height - 1) str += "\n";
				}
				preRef.current.textContent = str;
			}

			rafId = requestAnimationFrame(frame);
		}

		rafId = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(rafId);
	}, [width, height, R, r, K, D, du, dv, luminanceChars, speed, lx, ly, lz, yScale]);

	return (
		<pre
			ref={preRef}
			className={className}
			aria-label="ASCII donut output"
		/>
	);
}
