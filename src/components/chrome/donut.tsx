"use client";

import * as React from "react";
import type { DonutConfig } from "./donut-frames";
import { acquireBake, releaseBake, frameString } from "./donut-cache";

export interface DonutProps {
  width?: number;
  height?: number;
  R?: number;
  r?: number;
  /** Projection scale. Omit to auto-fit the torus to the grid (recommended). */
  K?: number;
  D?: number;
  /** Optional override for the adaptive u-sampling step (radians). */
  du?: number;
  /** Optional override for the adaptive v-sampling step (radians). */
  dv?: number;
  luminanceChars?: string;
  lightDirection?: [number, number, number];
  speed?: number;
  yScaleOverride?: number;
  className?: string;
  /** CSS background applied to the root element. Transparent by default. */
  background?: string;
  /**
   * Apply CSS `contain` to isolate the per-frame repaint (faster). Default true.
   * Set false when wrapping the donut in an effect that relies on inherited paint
   * — e.g. `<Chrome>`'s `background-clip: text` foil, which an isolated paint
   * context would knock out.
   */
  isolate?: boolean;
}

export function Donut({
  width = 60,
  height = 30,
  R = 0.4,
  r = 0.25,
  K,
  D = 4,
  du,
  dv,
  luminanceChars = " ,-~:;=!*#$@",
  lightDirection = [0, 1, -1],
  speed = 0.5625,
  yScaleOverride,
  className = "font-mono text-xs leading-[1] whitespace-pre cursor-default select-none",
  background,
  isolate = true,
}: DonutProps) {
  const preRef = React.useRef<HTMLPreElement | null>(null);

  const lx = lightDirection[0];
  const ly = lightDirection[1];
  const lz = lightDirection[2];

  React.useEffect(() => {
    const pre = preRef.current;
    if (!pre) return;
    let rafId = 0;
    let terminated = false;

    // Measure the char-cell aspect once, here (fonts are loaded by now), so the
    // bake runs a single time per mount instead of twice (initial guess + remeasure).
    let yScale = yScaleOverride ?? 0.55;
    if (yScaleOverride == null) {
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
      yScale = charWidth / lineHeight;
    }

    // Device tier feeds sampling density (coarser on weak hardware).
    const cores = navigator.hardwareConcurrency || 2;
    const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
    const isLowEnd = cores <= 4 || memory <= 4;

    const lMag = Math.hypot(lx, ly, lz) || 1;
    const chars = luminanceChars.length ? luminanceChars : " ";

    // Auto-fit the projection scale to the char grid so the torus always sits
    // inside its bounds with margin, at any width/height. A fixed K overflows
    // small grids (the donut gets clipped). Caller can still override K.
    const Keff =
      K ??
      0.82 * Math.min((width * D) / (2 * (R + r)), (height * D) / (2 * (R + r) * yScale));

    const cfg: DonutConfig = {
      width,
      height,
      R,
      r,
      K: Keff,
      D,
      du,
      dv,
      Lx: lx / lMag,
      Ly: ly / lMag,
      Lz: lz / lMag,
      chars,
      speed,
      yScale,
      isLowEnd,
    };

    // Shared across every Donut with this exact config: one precomputed frame
    // array, one bake, one worker. Identical donuts iterate the same strings.
    const handle = acquireBake(cfg);
    const N = handle.N;

    const frameBudget = isLowEnd ? 33 : 0; // ~30fps on low-end, vsync otherwise
    let lastFrameTime = 0;
    let fi = 0;

    function frame(now: number) {
      if (frameBudget > 0 && now - lastFrameTime < frameBudget) {
        rafId = requestAnimationFrame(frame);
        return;
      }
      lastFrameTime = now;

      if (!terminated && pre) pre.textContent = frameString(handle, fi);
      fi = (fi + 1) % N;

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => {
      terminated = true;
      cancelAnimationFrame(rafId);
      releaseBake(handle);
    };
  }, [width, height, R, r, K, D, du, dv, luminanceChars, speed, lx, ly, lz, yScaleOverride]);

  return (
    <pre
      ref={preRef}
      className={className}
      style={{ background, contain: isolate ? "layout paint style" : undefined }}
      aria-label="ASCII donut"
    />
  );
}
