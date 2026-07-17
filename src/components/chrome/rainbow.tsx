import * as React from "react";

const KEYFRAMES = `@keyframes chrome-rainbow-cycle {
  0%   { color: hsl(0,   95%, 65%); }
  20%  { color: hsl(60,  95%, 65%); }
  40%  { color: hsl(120, 80%, 60%); }
  60%  { color: hsl(200, 95%, 65%); }
  80%  { color: hsl(280, 90%, 70%); }
  100% { color: hsl(360, 95%, 65%); }
}`;

export interface RainbowProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  duration?: number;
  stagger?: number;
  /** CSS background applied to the root element. Transparent by default. */
  background?: string;
}

// Visually-hidden but screen-reader-visible (the standard sr-only clip
// pattern) — inline styles so the component stays dependency-free.
const SR_ONLY: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

/** Pull plain text out of a node tree — used for the accessible name. */
function extractText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<{ children?: React.ReactNode }>;
    return extractText(el.props.children);
  }
  return "";
}

// Recursively rebuild the child tree, replacing every text character with a
// staggered hue-cycle span. `next()` hands out a monotonic index so the
// stagger flows continuously across the whole subtree, not per text node —
// element wrappers (spans, links, etc.) are preserved.
function rainbowify(
  node: React.ReactNode,
  duration: number,
  stagger: number,
  next: () => number,
): React.ReactNode {
  if (typeof node === "string" || typeof node === "number") {
    return Array.from(String(node)).map((ch) => {
      const idx = next();
      return (
        <span
          key={idx}
          aria-hidden
          style={{
            display: "inline-block",
            whiteSpace: "pre",
            animation: `chrome-rainbow-cycle ${duration}s linear infinite`,
            animationDelay: `${-stagger * idx}s`,
          }}
        >
          {ch}
        </span>
      );
    });
  }
  if (Array.isArray(node)) {
    return node.map((n, i) => (
      <React.Fragment key={i}>{rainbowify(n, duration, stagger, next)}</React.Fragment>
    ));
  }
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<{ children?: React.ReactNode }>;
    if (el.props.children == null) return node;
    return React.cloneElement(
      el,
      undefined,
      rainbowify(el.props.children, duration, stagger, next),
    );
  }
  return node;
}

/** Wrap any content — every text character inside cycles through the rainbow. */
export function Rainbow({
  as: Tag = "span",
  duration = 3,
  stagger = 0.25,
  background,
  style,
  children,
  ...rest
}: RainbowProps) {
  let counter = 0;
  const next = () => counter++;
  return (
    <>
      <style precedence="default" href="chrome-rainbow-keyframes">
        {KEYFRAMES}
      </style>
      <Tag style={{ background, ...style }} {...rest}>
        {/* Real text for assistive tech — aria-label on a generic span is
            unreliable, so an sr-only element carries the accessible name while
            the animated glyphs stay aria-hidden. */}
        <span style={SR_ONLY}>{extractText(children)}</span>
        {rainbowify(children, duration, stagger, next)}
      </Tag>
    </>
  );
}
