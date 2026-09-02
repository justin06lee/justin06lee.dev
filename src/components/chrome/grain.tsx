import * as React from "react";
import { cn } from "@/lib/utils";

export type GrainVariant = "noise" | "paper" | "dots";

export type GrainProps = {
  variant?: GrainVariant;
  /** Layer opacity. Grain works best barely visible — past ~0.12 it reads as dirt. */
  opacity?: number;
  /**
   * Texture scale. For noise/paper this is the turbulence base frequency
   * (higher is finer, default 0.8); for dots it is the dot pitch in px
   * (default 4). Omit it and each variant gets the default that suits it.
   */
  scale?: number;
  /** Jitter the texture like film grain. Frozen under reduced motion. */
  animate?: boolean;
  /**
   * Cover the viewport rather than the nearest positioned ancestor. Fixed is
   * right for a page-wide texture; absolute for texturing one panel.
   */
  fixed?: boolean;
  /** CSS mix-blend-mode for the layer. */
  blend?: React.CSSProperties["mixBlendMode"];
  className?: string;
};

/**
 * Paper / film texture overlay.
 *
 * The texture is an inline SVG `feTurbulence` data URI rather than a bundled
 * PNG: it is a few hundred bytes, resolution-independent, and the caller can
 * retune its grain without shipping a second asset. The layer is
 * `pointer-events-none` and `aria-hidden`, so it can sit over live UI at any
 * z-index without swallowing clicks.
 *
 * The animation steps the background position through a handful of offsets
 * rather than tweening it — smooth motion reads as a moving pattern, whereas
 * discrete jumps read as grain.
 */
export function Grain({
  variant = "noise",
  opacity = 0.05,
  scale,
  animate = false,
  fixed = true,
  blend,
  className,
}: GrainProps) {
  const texture = React.useMemo(() => {
    // The two families measure scale in different units — a base frequency
    // around 0.8 is a fine speckle, while 0.8px would be an invisible dot
    // pitch — so the default is resolved per variant rather than shared.
    const resolved = scale ?? (variant === "dots" ? 4 : 0.8);

    if (variant === "dots") {
      return {
        backgroundImage: "radial-gradient(currentColor 0.5px, transparent 0.5px)",
        backgroundSize: `${resolved}px ${resolved}px`,
      };
    }

    // `turbulence` gives long fibrous streaks (paper stock); `fractalNoise`
    // gives even speckle (film). stitchTiles keeps the seams invisible when the
    // 200px tile repeats.
    const type = variant === "paper" ? "turbulence" : "fractalNoise";
    const frequency =
      variant === "paper" ? `${(resolved * 0.05).toFixed(4)} ${resolved}` : `${resolved}`;
    const octaves = variant === "paper" ? 3 : 4;
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>` +
      `<filter id='g'><feTurbulence type='${type}' baseFrequency='${frequency}' numOctaves='${octaves}' stitchTiles='stitch'/></filter>` +
      `<rect width='200' height='200' filter='url(%23g)'/></svg>`;

    return {
      backgroundImage: `url("data:image/svg+xml,${svg.replace(/</g, "%3C").replace(/>/g, "%3E").replace(/#/g, "%23")}")`,
      backgroundSize: "200px 200px",
    };
  }, [variant, scale]);

  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none inset-0",
        fixed ? "fixed" : "absolute",
        animate && "chrome-grain-jitter",
        className,
      )}
      style={{ ...texture, opacity, mixBlendMode: blend }}
    >
      <style precedence="default" href="chrome-grain-keyframes">{`
        @keyframes chrome-grain-jitter {
          0%   { background-position: 0 0; }
          20%  { background-position: -13px 7px; }
          40%  { background-position: 9px -11px; }
          60%  { background-position: -7px -5px; }
          80%  { background-position: 11px 9px; }
          100% { background-position: 0 0; }
        }
        .chrome-grain-jitter {
          animation: chrome-grain-jitter 0.5s steps(1, end) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .chrome-grain-jitter { animation: none; }
        }
      `}</style>
    </span>
  );
}
