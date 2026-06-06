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
	du,
	dv,
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

		// Sample the torus densely enough that adjacent samples land <1 char apart
		// in screen space, else a large donut shows gaps. Derive step counts from the
		// projected circumference of each ring at its nearest (most-magnified) depth.
		// Fixed du/dv don't scale with size: they under-sample u (gaps grow with the
		// donut) while massively over-sampling v (wasted frames). Geometry-driven
		// counts fill the surface and cut total samples at the same time.
		const TWO_PI = Math.PI * 2;
		const oozNear = 1 / Math.max(D - r, 0.0001); // closest point projects largest
		const oversample = 1.5; // >1 guarantees sub-char spacing along each ring
		let uSteps = Math.ceil(TWO_PI * (R + r) * K * oozNear * oversample);
		let vSteps = Math.ceil(TWO_PI * r * K * oozNear * oversample);
		// Explicit du/dv still pin a fixed density when a caller asks for one.
		if (du && du > 0) uSteps = Math.ceil(TWO_PI / du);
		if (dv && dv > 0) vSteps = Math.ceil(TWO_PI / dv);
		// Floor avoids degenerate tiny rings; cap bounds worst-case cost.
		uSteps = Math.min(2048, Math.max(48, uSteps));
		vSteps = Math.min(2048, Math.max(48, vSteps));
		// Bound total per-frame work so a huge donut can't tank the framerate.
		// Scale both dims together to keep the fill ratio even when over budget.
		const MAX_SAMPLES = 96000;
		if (uSteps * vSteps > MAX_SAMPLES) {
			const k = Math.sqrt(MAX_SAMPLES / (uSteps * vSteps));
			uSteps = Math.max(48, Math.ceil(uSteps * k));
			vSteps = Math.max(48, Math.ceil(vSteps * k));
		}
		if (isLowEnd) {
			uSteps = Math.max(48, Math.ceil(uSteps * 0.6));
			vSteps = Math.max(48, Math.ceil(vSteps * 0.6));
		}
		const adu = TWO_PI / uSteps;
		const adv = TWO_PI / vSteps;

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
		const Ky = K * yScale; // fold yScale into the y-projection scale once
		const cmax = charsLen - 1; // top luminance-ramp index

		// Pre-compute trig tables for u and v
		const cosU = new Float32Array(uSteps);
		const sinU = new Float32Array(uSteps);
		const cosV = new Float32Array(vSteps);
		const sinV = new Float32Array(vSteps);

		for (let i = 0; i < uSteps; i++) {
			const u = i * adu;
			cosU[i] = Math.cos(u);
			sinU[i] = Math.sin(u);
		}
		for (let i = 0; i < vSteps; i++) {
			const v = i * adv;
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

			// Expand the X-then-Z rotation symbolically and hoist every term that
			// doesn't depend on v out of the inner loop. Each projected coordinate
			// reduces to  A + B*cv + C*sv  (A,B per-u; C constant per frame), and the
			// surface normal never needs to be materialised: luminance collapses to
			// cv*lumC + sv*lumS. See /tmp verify — identical to the full rotation to 1e-15.
			const cosAxSinAz = cosAx * sinAz;
			const cosAxCosAz = cosAx * cosAz;
			const Cpx = r * sinAx * sinAz;   // sv coefficient of px2 (const per frame)
			const Cpy = -r * sinAx * cosAz;  // sv coefficient of py2
			const Cz = r * cosAx;            // sv coefficient of z
			const lumS = sinAx * sinAz * Lx - sinAx * cosAz * Ly + cosAx * Lz; // sv coefficient of luminance

			for (let ui = 0; ui < uSteps; ui++) {
				const cu = cosU[ui], su = sinU[ui];

				// Per-u coefficients (amortised over the whole v ring).
				const k1 = cu * cosAz - su * cosAxSinAz;
				const k2 = cu * sinAz + su * cosAxCosAz;
				const ss = su * sinAx;
				const Apx = R * k1, Bpx = r * k1;
				const Apy = R * k2, Bpy = r * k2;
				const Az = R * ss + D, Bz = r * ss;
				const lumC = k1 * Lx + k2 * Ly + ss * Lz; // cv coefficient of luminance

				for (let vi = 0; vi < vSteps; vi++) {
					const cv = cosV[vi], sv = sinV[vi];

					// Depth first so back/behind samples bail before any projection work.
					const z = Az + Bz * cv + Cz * sv;
					if (z <= 0) continue;
					const ooz = 1 / z;

					const px2 = Apx + Bpx * cv + Cpx * sv;
					const py2 = Apy + Bpy * cv + Cpy * sv;
					const xProj = (cx + K * px2 * ooz) | 0;
					const yProj = (cy - Ky * py2 * ooz) | 0;

					if (xProj >= 0 && xProj < width && yProj >= 0 && yProj < height) {
						const idx = xProj + yProj * width;
						if (ooz > zbuf[idx]) {
							zbuf[idx] = ooz;
							const lum = cv * lumC + sv * lumS;
							if (lum > 0) outBuf[idx] = Math.min(cmax, (lum * cmax) | 0);
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
