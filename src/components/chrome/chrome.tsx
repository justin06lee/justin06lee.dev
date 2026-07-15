import * as React from "react";

/**
 * The foil paint stack + shine animation, exported so components that compose
 * chrome (e.g. gallery's pinned marker) can clip it with a CSS mask instead of
 * text glyphs. Pair with an element that has the `data-chrome` attribute so the
 * prefers-reduced-motion freeze applies, and render it alongside a <Chrome>
 * (which injects the `chrome-shine` keyframes).
 */
export const CHROME_FOIL_STYLE: React.CSSProperties = {
  background: [
    "linear-gradient(115deg," +
      "transparent 30%," +
      "rgba(255,255,255,0.85) 48%," +
      "rgba(255,255,255,0.95) 50%," +
      "rgba(255,255,255,0.85) 52%," +
      "transparent 70%)",
    "repeating-linear-gradient(48deg," +
      "rgba(255,255,255,0) 0 1px," +
      "rgba(255,255,255,0.12) 1px 2px," +
      "rgba(0,0,0,0.05) 2px 4px)",
    "linear-gradient(180deg," +
      "hsl(195, 95%, 88%) 0%," +
      "hsl(170, 75%, 82%) 14%," +
      "hsl(85, 70%, 84%) 26%," +
      "hsl(50, 95%, 86%) 38%," +
      "hsl(25, 90%, 88%) 50%," +
      "hsl(345, 80%, 88%) 62%," +
      "hsl(310, 70%, 88%) 74%," +
      "hsl(265, 70%, 88%) 86%," +
      "hsl(210, 90%, 88%) 100%)",
  ].join(", "),
  backgroundSize: "220% 100%, 100% 100%, 100% 100%",
  backgroundPosition: "-50% 0, 0 0, 0 0",
  backgroundRepeat: "no-repeat",
  animation: "chrome-shine 5s cubic-bezier(.4,0,.6,1) infinite",
};

/**
 * Chrome's bevel + glow, exported alongside CHROME_FOIL_STYLE. A sharp bevel
 * (blur 0, cheap) plus ONE small-radius glow. Big-radius drop-shadows (the old
 * 60px + 120px blurs) get re-rasterized on every repaint, so when Chrome wraps
 * animating content — e.g. a <Donut isolate={false}> that rewrites its text
 * each frame — they re-blur ~60×/sec and pin a core. A 24px glow keeps the
 * halo while costing a fraction to repaint.
 */
export const CHROME_GLOW_STYLE: React.CSSProperties = {
  filter:
    "drop-shadow(0 2px 0 rgba(255,255,255,0.18)) " +
    "drop-shadow(0 0 24px rgba(198,206,255,0.22))",
};

const CHROME_STYLE: React.CSSProperties = {
  ...CHROME_FOIL_STYLE,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  ...CHROME_GLOW_STYLE,
};

// `background-clip: text` clips the wrapper's gradient to every glyph it
// contains, descendants included — so Chrome works as a wrapper around any
// content. But a nested element with its own `color` would paint opaque text
// over that clipped gradient; force every descendant transparent so the
// chrome shows through all text inside.
const KEYFRAMES = `@keyframes chrome-shine {
  0%   { background-position: -50% 0, 0 0, 0 0; }
  100% { background-position: 250% 0, 0 0, 0 0; }
}
[data-chrome] * { color: transparent !important; }
@media (prefers-reduced-motion: reduce) {
  [data-chrome] { animation: none !important; background-position: 50% 0, 0 0, 0 0 !important; }
}`;

export interface ChromeProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
}

/** Wrap any content — every text glyph inside renders with the chrome foil effect. */
export function Chrome({ as: Tag = "span", style, children, ...rest }: ChromeProps) {
  return (
    <>
      <style precedence="default" href="chrome-shine-keyframes">
        {KEYFRAMES}
      </style>
      <Tag data-chrome style={{ ...CHROME_STYLE, ...style }} {...rest}>
        {children}
      </Tag>
    </>
  );
}
