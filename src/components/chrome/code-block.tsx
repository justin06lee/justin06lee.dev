"use client";

import * as React from "react";
import { Highlight, type PrismTheme } from "prism-react-renderer";
import { cn } from "@/lib/utils";

export type CodeBlockProps = {
  /** Source code to render. Trailing newline is trimmed. */
  code: string;
  /** Prism language id. Common ones bundled: tsx, ts, jsx, js, bash, json, css, markup. */
  language?: string;
  /** Show the copy button (top-right). Defaults to true. */
  copyable?: boolean;
  /** ms before the copy label reverts. */
  resetMs?: number;
  className?: string;
};

/**
 * Monochrome syntax-highlighted code box with a built-in copy button. Built on
 * prism-react-renderer (sync, pure-React tokens — no async/WASM). The theme is a
 * restrained palette tuned for a black background; swap `chromeTheme` to retint.
 */
const chromeTheme: PrismTheme = {
  plain: { color: "#e5e5e5", backgroundColor: "transparent" },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "rgba(255,255,255,0.35)", fontStyle: "italic" } },
    { types: ["punctuation", "operator"], style: { color: "rgba(255,255,255,0.55)" } },
    { types: ["keyword", "builtin", "boolean", "selector"], style: { color: "#c4b5fd" } },
    { types: ["string", "char", "attr-value", "inserted"], style: { color: "#a7f3d0" } },
    { types: ["function", "tag", "deleted"], style: { color: "#93c5fd" } },
    { types: ["number", "constant", "symbol"], style: { color: "#fbbf24" } },
    { types: ["attr-name", "property", "variable"], style: { color: "#f9a8d4" } },
    { types: ["class-name", "maybe-class-name", "namespace"], style: { color: "#67e8f9" } },
  ],
};

export function CodeBlock({
  code,
  language = "tsx",
  copyable = true,
  resetMs = 2000,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);
  const source = code.replace(/\n$/, "");

  React.useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
    } catch {
      /* clipboard blocked */
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), resetMs);
  };

  return (
    <div className={cn("relative", className)}>
      <Highlight code={source} language={language} theme={chromeTheme}>
        {({ className: hlClass, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={cn(
              hlClass,
              "border border-white/10 bg-white/[0.02] p-4 pr-16 text-[12px] leading-[1.7] overflow-x-auto",
            )}
            style={style}
          >
            {tokens.map((line, i) => {
              const { key: _lk, ...lineProps } = getLineProps({ line });
              return (
                <div key={i} {...lineProps}>
                  {line.map((token, j) => {
                    const { key: _tk, ...tokenProps } = getTokenProps({ token });
                    return <span key={j} {...tokenProps} />;
                  })}
                </div>
              );
            })}
          </pre>
        )}
      </Highlight>
      {copyable && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label="copy code"
          className="absolute top-2.5 right-3 select-none font-mono text-[11px] text-white/45 transition-colors hover:text-white"
        >
          {copied ? "copied" : "copy"}
        </button>
      )}
      {/* Announce copy result via a dedicated live region rather than the
          button's toggling label, which is an unreliable live region. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "copied" : ""}
      </span>
    </div>
  );
}
