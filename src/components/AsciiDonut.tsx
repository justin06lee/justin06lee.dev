"use client";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { makeDonutRenderer, indicesToString, type DonutConfig } from "./donut-frames";
import type { BakeResult } from "./AsciiDonut.worker";

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
		let terminated = false;

		// Device tier feeds sampling density (coarser on weak hardware).
		const cores = navigator.hardwareConcurrency || 2;
		const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
		const isLowEnd = cores <= 4 || memory <= 4;

		const lMag = Math.hypot(lx, ly, lz) || 1;
		const chars = luminanceChars.length ? luminanceChars : " ";

		const cfg: DonutConfig = {
			width, height, R, r, K, D, du, dv,
			Lx: lx / lMag, Ly: ly / lMag, Lz: lz / lMag,
			chars, speed, yScale, isLowEnd,
		};

		// Renderer used only for the few frames before the background bake lands.
		const live = makeDonutRenderer(cfg);
		const N = live.N;
		const bufSize = live.bufSize;

		const frameBudget = isLowEnd ? 33 : 0; // ~30fps on low-end, vsync otherwise
		let lastFrameTime = 0;
		let fi = 0;

		// Full loop baked off-thread into an index buffer; strings materialised lazily
		// on first replay of each frame (spreads the allocation, no main-thread bake).
		let baked: Uint8Array | null = null;
		const strCache: (string | undefined)[] = new Array(N);

		let worker: Worker | null = null;
		if (typeof Worker !== "undefined") {
			try {
				worker = new Worker(new URL("./AsciiDonut.worker.ts", import.meta.url), { type: "module" });
				worker.onmessage = (e: MessageEvent<BakeResult>) => {
					if (!terminated) baked = e.data.buf;
				};
				worker.postMessage(cfg);
			} catch {
				worker = null; // no worker → live render forever (still cheap)
			}
		}

		function replayString(i: number): string {
			let s = strCache[i];
			if (s === undefined) {
				s = indicesToString(baked!, i * bufSize, width, height, chars);
				strCache[i] = s;
			}
			return s;
		}

		function frame(now: number) {
			if (frameBudget > 0 && now - lastFrameTime < frameBudget) {
				rafId = requestAnimationFrame(frame);
				return;
			}
			lastFrameTime = now;

			const pre = preRef.current;
			if (pre) pre.textContent = baked ? replayString(fi) : live.renderString(fi);
			fi = (fi + 1) % N;

			rafId = requestAnimationFrame(frame);
		}

		rafId = requestAnimationFrame(frame);
		return () => {
			terminated = true;
			cancelAnimationFrame(rafId);
			if (worker) worker.terminate();
		};
	}, [width, height, R, r, K, D, du, dv, luminanceChars, speed, lx, ly, lz, yScale]);

	return (
		<pre
			ref={preRef}
			className={className}
			aria-label="ASCII donut output"
			style={{ contain: "layout paint style" }}
		/>
	);
}
