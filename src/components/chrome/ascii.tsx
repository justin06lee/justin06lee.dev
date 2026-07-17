"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface AsciiProps {
  /**
   * URL/path of a plain-text file holding the art (e.g. "/ascii/cat.txt").
   * Fetched on mount and rendered exactly as authored.
   */
  src?: string;
  /** Inline art. With `src`, renders as the placeholder until the file loads. */
  children?: string | string[];
  /** Accessible name (role="img"). Omit for purely decorative art (aria-hidden). */
  label?: string;
  /** Font size in px. Default 12. */
  size?: number;
  /** Line-height multiplier. Default 1.15 — tight enough that box-drawing rows touch. */
  lineHeight?: number;
  className?: string;
}

// Fetch each file once per page, shared across instances.
const fileCache = new Map<string, Promise<string>>();

function loadArt(src: string): Promise<string> {
  let pending = fileCache.get(src);
  if (!pending) {
    pending = fetch(src).then((res) => {
      if (!res.ok) throw new Error(`ascii: failed to load ${src} (${res.status})`);
      return res.text();
    });
    pending.catch(() => fileCache.delete(src)); // let a later mount retry
    fileCache.set(src, pending);
  }
  return pending;
}

// Exact-grid normalization: strip a BOM, unify newlines, drop only TRAILING
// newlines — leading spaces and blank lines inside the art are meaningful.
function normalize(art: string): string {
  return art.replace(/^﻿/, "").replace(/\r\n?/g, "\n").replace(/\n+$/, "");
}

/**
 * Seamless ASCII-art renderer: a mono <pre> locked to a fixed character grid —
 * ligatures and contextual alternates off, tabs normalized, tight line height —
 * so art never shifts, collapses, or renders "weirdly". Point `src` at a .txt
 * file or pass the art as the string child. Static and paint-plain, which means
 * wrapping it in `<Chrome>` foils every glyph with zero extra setup.
 */
export function Ascii({
  src,
  children,
  label,
  size = 12,
  lineHeight = 1.15,
  className,
}: AsciiProps) {
  const inline = Array.isArray(children) ? children.join("") : (children ?? "");
  const [loaded, setLoaded] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!src) return;
    let cancelled = false;
    setLoaded(null);
    loadArt(src).then(
      (text) => {
        if (!cancelled) setLoaded(text);
      },
      () => {
        if (!cancelled) setLoaded(null); // keep the inline fallback on error
      },
    );
    return () => {
      cancelled = true;
    };
  }, [src]);

  const art = normalize(src && loaded != null ? loaded : inline);

  return (
    <pre
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className={cn(
        "inline-block select-none whitespace-pre text-left font-mono text-white/80",
        className,
      )}
      style={{
        fontSize: size,
        lineHeight,
        // Ligatures/alternates merge glyph pairs (=>, |-, fi) and break the grid.
        fontVariantLigatures: "none",
        fontFeatureSettings: '"liga" 0, "calt" 0',
        tabSize: 4,
        textRendering: "geometricPrecision",
      }}
    >
      {art}
    </pre>
  );
}
