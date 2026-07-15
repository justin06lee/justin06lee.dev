"use client";

import * as React from "react";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

function ScrambleWord({ text, speed = 30, step = 1 / 3 }: { text: string; speed?: number; step?: number }) {
  const visRef = React.useRef<HTMLSpanElement | null>(null);
  const sizerRef = React.useRef<HTMLSpanElement | null>(null);
  const intervalRef = React.useRef<number | null>(null);
  const [widthPx, setWidthPx] = React.useState<number | null>(null);

  React.useLayoutEffect(() => {
    const measure = () => {
      if (!sizerRef.current) return;
      const w = sizerRef.current.getBoundingClientRect().width;
      if (w) setWidthPx(Math.ceil(w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (sizerRef.current) ro.observe(sizerRef.current);
    return () => ro.disconnect();
  }, [text]);

  React.useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [text]);

  const handleEnter = () => {
    let iteration = 0;
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      const node = visRef.current;
      if (!node) return;
      const scrambled = text
        .split("")
        .map((_, idx) =>
          idx < iteration ? text[idx] : LETTERS[Math.floor(Math.random() * 26)],
        )
        .join("");
      node.textContent = scrambled;
      iteration += step;
      if (iteration >= text.length) {
        window.clearInterval(intervalRef.current!);
        intervalRef.current = null;
        node.textContent = text;
      }
    }, speed);
  };

  return (
    <>
      <span
        ref={sizerRef}
        className="absolute -left-[9999px] -top-[9999px] whitespace-pre"
        aria-hidden
      >
        {text}
      </span>
      <span
        className="inline-block whitespace-nowrap align-baseline cursor-default"
        style={widthPx ? { minWidth: `${widthPx}px` } : undefined}
        onMouseEnter={handleEnter}
      >
        {/* Real text for assistive tech — aria-label on a generic span is
            unreliable, so an sr-only element carries the accessible name while
            the scrambling glyphs stay aria-hidden. */}
        <span className="sr-only">{text}</span>
        <span ref={visRef} aria-hidden>{text}</span>
      </span>
    </>
  );
}

export interface ScrambleProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  speed?: number;
  step?: number;
  /** CSS background applied to the root element. Transparent by default. */
  background?: string;
}

// Recursively rebuild the child tree, splitting every text node into
// hover-scramble words (whitespace runs kept as plain spans). Element
// wrappers (links, spans, etc.) are preserved.
function scrambleify(
  node: React.ReactNode,
  speed: number | undefined,
  step: number | undefined,
): React.ReactNode {
  if (typeof node === "string" || typeof node === "number") {
    return String(node)
      .split(/(\s+)/)
      .map((p, i) =>
        p === "" || /\s+/.test(p) ? (
          <span key={i}>{p}</span>
        ) : (
          <ScrambleWord key={i} text={p} speed={speed} step={step} />
        ),
      );
  }
  if (Array.isArray(node)) {
    return node.map((n, i) => (
      <React.Fragment key={i}>{scrambleify(n, speed, step)}</React.Fragment>
    ));
  }
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<{ children?: React.ReactNode }>;
    if (el.props.children == null) return node;
    return React.cloneElement(el, undefined, scrambleify(el.props.children, speed, step));
  }
  return node;
}

/** Wrap any content — every word inside scrambles on hover. */
export function Scramble({
  as: Tag = "span",
  speed,
  step,
  background,
  style,
  children,
  ...rest
}: ScrambleProps) {
  return (
    <Tag style={{ background, ...style }} {...rest}>
      {scrambleify(children, speed, step)}
    </Tag>
  );
}
