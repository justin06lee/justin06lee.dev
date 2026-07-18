"use client";

import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import { CodeBlock } from "@/components/chrome/code-block";
import "katex/dist/katex.min.css";

export type ProseProps = {
  /** Markdown source. */
  children: string;
  /** Prefix for relative image srcs (e.g. a GitHub raw base). */
  imageBaseUrl?: string;
  /**
   * When true, stamps each top-level block with `data-source-line` (its 1-based
   * source line) so a host can map editor lines to rendered blocks for
   * scroll/highlight sync. Off by default — zero overhead when unused.
   */
  lineSync?: boolean;
  /**
   * 1-based source line of the block to highlight (the synced block). The last
   * top-level block at/above this line is marked with `data-sync-highlight`.
   * Declarative — rendered into the markup so a re-render can't strand it. Only
   * applies when `lineSync` is true.
   */
  highlightLine?: number | null;
  /**
   * Anchor element/component for internal links (relative, `/…`, `#…`) — pass
   * your router's Link for client-side navigation. External links (`http(s)://`,
   * `mailto:`, …) always render a plain `<a>` (http(s) opens in a new tab).
   * Default "a".
   */
  linkComponent?: React.ElementType;
  /**
   * Which variant to render for images that ship a light/dark pair — files
   * named `<name>-light.<ext>` and `<name>-dark.<ext>`. An image src carrying a
   * `-light`/`-dark` suffix is resolved to this theme's variant; images without
   * that suffix are left untouched. **Defaults to `"light"`** so light-authored
   * drawings/diagrams stay light in a light context; a dark-themed site (e.g.
   * one forcing dark mode) passes `imageTheme="dark"` to use the dark variants.
   * Applied after `imageBaseUrl`, before `resolveImageSrc`.
   */
  imageTheme?: "light" | "dark";
  /**
   * Maps each image src to the src actually rendered — an escape hatch for
   * custom variant logic. Runs after `imageBaseUrl` and `imageTheme` resolution,
   * so it receives the already-theme-resolved src.
   */
  resolveImageSrc?: (src: string) => string;
  className?: string;
};

// A `-light`/`-dark` variant suffix directly before the file extension, with an
// optional `?query`/`#hash` tail preserved (GitHub raw urls carry a ?token).
const IMAGE_VARIANT_RE = /^(.*)-(light|dark)(\.[a-z0-9]+)([?#].*)?$/i;

/**
 * Resolve a light/dark image-variant src to the requested theme. An src whose
 * filename ends in `-light`/`-dark` (before the extension) is rewritten to the
 * matching variant; anything else is returned unchanged. Authoring convention:
 * save/reference paired files `<name>-light.<ext>` and `<name>-dark.<ext>`.
 */
export function resolveThemeImageSrc(src: string, theme: "light" | "dark"): string {
  const m = IMAGE_VARIANT_RE.exec(src);
  if (!m) return src;
  const base = m[1];
  const variant = m[2];
  const ext = m[3];
  const tail = m[4] ?? "";
  if (base === undefined || variant === undefined || ext === undefined) return src;
  if (variant.toLowerCase() === theme) return src;
  return `${base}-${theme}${ext}${tail}`;
}

// Copies each top-level block's source line (1-based, relative to the markdown)
// onto a `data-source-line` attribute, and marks the highlighted block with
// `data-sync-highlight`. Only top-level children are tagged so a host maps a line
// to exactly one block instead of every nested element.
function rehypeSourceLine(options?: { highlightLine?: number | null }) {
  const highlightLine = options?.highlightLine ?? null;
  return (tree: { children?: Array<Record<string, unknown>> }) => {
    // the last top-level block at/above the target line is the one to highlight
    let highlightTarget: Record<string, unknown> | null = null;
    for (const node of tree.children ?? []) {
      const position = node.position as
        | { start?: { line?: number } }
        | undefined;
      const line = position?.start?.line;
      if (node.type === "element" && typeof line === "number") {
        const properties = (node.properties ?? {}) as Record<string, unknown>;
        properties.dataSourceLine = line;
        node.properties = properties;
        if (highlightLine != null && line <= highlightLine) {
          highlightTarget = properties;
        }
      }
    }
    if (highlightTarget) {
      highlightTarget.dataSyncHighlight = true;
    }
  };
}

function isExternal(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

// Internal = no protocol scheme (mailto:, http:, …) and not protocol-relative —
// i.e. relative paths, `/…`, and `#…` anchors. These render through
// `linkComponent`; everything else stays a plain `<a>`.
function isInternal(href: string): boolean {
  return !/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith("//");
}

function isResolved(src: string): boolean {
  return /^(https?:|data:|\/)/.test(src);
}

const HEADING_SCROLL = { scrollMarginTop: "var(--sticky-header-offset, 80px)" };

/**
 * Markdown renderer with the justin06lee.dev prose styling — GFM, math (KaTeX),
 * heading slugs, and syntax-highlighted code blocks (via `code-block`). Dark-only. Pass markdown as the
 * single string child.
 */
// Paints the block tagged with `data-sync-highlight` (by rehypeSourceLine) as the
// gray sync streak. Text blocks bleed the fill horizontally past the words so it
// doesn't hug them; block-ish content keeps a tight box; an opaque image gets an
// outline instead. Injected only when lineSync is on (no global stylesheet needed).
const SYNC_HIGHLIGHT_CSS = `[data-sync-highlight]{background-color:rgba(255,255,255,0.1);}
:is(p,h1,h2,h3,h4,h5,h6)[data-sync-highlight]{--sync-bleed:0.5rem;margin-left:calc(-1*var(--sync-bleed));margin-right:calc(-1*var(--sync-bleed));padding-left:var(--sync-bleed);padding-right:var(--sync-bleed);}
[data-sync-highlight] img,img[data-sync-highlight]{outline:2px solid rgba(255,255,255,0.7);outline-offset:3px;}`;

export function Prose({
  children,
  imageBaseUrl,
  lineSync = false,
  highlightLine = null,
  linkComponent: LinkComponent = "a",
  imageTheme = "light",
  resolveImageSrc,
  className,
}: ProseProps) {
  // Memoize so the component map is stable across renders (only `imageBaseUrl`,
  // `linkComponent`, and `resolveImageSrc` affect it via the `a`/`img`
  // renderers); otherwise ReactMarkdown re-renders the whole tree every render.
  const components: Components = useMemo(() => ({
    h1: ({ children, node, ...p }) => (
      <h1 className="mb-4 mt-10 text-3xl font-semibold tracking-tight text-white first:mt-0" style={HEADING_SCROLL} {...p}>{children}</h1>
    ),
    h2: ({ children, node, ...p }) => (
      <h2 className="mb-3 mt-10 text-2xl font-semibold tracking-tight text-white" style={HEADING_SCROLL} {...p}>{children}</h2>
    ),
    h3: ({ children, node, ...p }) => (
      <h3 className="mb-2 mt-8 text-xl font-semibold tracking-tight text-white" style={HEADING_SCROLL} {...p}>{children}</h3>
    ),
    h4: ({ children, node, ...p }) => (
      <h4 className="mb-2 mt-6 text-lg font-semibold text-white" style={HEADING_SCROLL} {...p}>{children}</h4>
    ),
    h5: ({ children, node, ...p }) => (
      <h5 className="mb-2 mt-5 text-base font-semibold text-white" style={HEADING_SCROLL} {...p}>{children}</h5>
    ),
    h6: ({ children, node, ...p }) => (
      <h6 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-widest text-white/60" style={HEADING_SCROLL} {...p}>{children}</h6>
    ),
    p: ({ children, node, ...p }) => <p className="my-4 text-[15px] leading-7 text-white/85" {...p}>{children}</p>,
    a: ({ children, href }) => {
      const value = typeof href === "string" ? href : "";
      const cls = "text-white underline decoration-white/40 underline-offset-4 transition-colors hover:decoration-white";
      if (value && isInternal(value)) {
        return (
          <LinkComponent href={value} className={cls}>
            {children}
          </LinkComponent>
        );
      }
      return (
        <a
          href={value || undefined}
          className={cls}
          {...(isExternal(value) && { target: "_blank", rel: "noopener noreferrer" })}
        >
          {children}
        </a>
      );
    },
    strong: ({ children, node, ...p }) => <strong className="font-semibold text-white" {...p}>{children}</strong>,
    em: ({ children, node, ...p }) => <em className="italic" {...p}>{children}</em>,
    ul: ({ children, node, ...p }) => <ul className="my-4 ml-6 list-disc space-y-1.5 text-white/85" {...p}>{children}</ul>,
    ol: ({ children, node, ...p }) => <ol className="my-4 ml-6 list-decimal space-y-1.5 text-white/85" {...p}>{children}</ol>,
    li: ({ children, node, ...p }) => <li className="text-[15px] leading-7" {...p}>{children}</li>,
    blockquote: ({ children, node, ...p }) => (
      <blockquote className="my-5 border-l-2 border-white/30 pl-4 italic text-white/60" {...p}>{children}</blockquote>
    ),
    code: ({ children, className: cls, node, ...p }) => {
      const text = String(children).replace(/\n$/, "");
      const multiline =
        node?.position?.start.line !== undefined &&
        node.position.end.line !== undefined &&
        node.position.start.line !== node.position.end.line;
      const block = cls?.includes("language-") || multiline;
      if (block) {
        return <code className={`block font-mono text-[13px] leading-6 text-white/90 ${cls ?? ""}`} {...p}>{text}</code>;
      }
      return <code className="border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.85em] text-white" {...p}>{children}</code>;
    },
    pre: ({ node }) => {
      // Fenced code: extract the raw text + language from the hast node and
      // hand it to CodeBlock for syntax highlighting. The wrapper re-stamps the
      // pre's sync attributes so lineSync still targets the block.
      let text = "";
      let language: string | undefined;
      const first = node?.children?.[0];
      if (first && first.type === "element" && first.tagName === "code") {
        const cls = first.properties?.className;
        const classes = Array.isArray(cls) ? cls.map(String) : typeof cls === "string" ? [cls] : [];
        language = classes.find((c) => c.startsWith("language-"))?.slice("language-".length);
        text = first.children.map((c) => (c.type === "text" ? c.value : "")).join("");
      }
      const properties = node?.properties ?? {};
      return (
        <div
          className="my-5"
          data-source-line={properties.dataSourceLine as number | undefined}
          data-sync-highlight={properties.dataSyncHighlight ? true : undefined}
        >
          <CodeBlock code={text.replace(/\n$/, "")} language={language ?? "markup"} />
        </div>
      );
    },
    table: ({ children, node, ...p }) => (
      <div className="my-5 overflow-x-auto">
        <table className="w-full border-collapse border border-white/10 text-sm" {...p}>{children}</table>
      </div>
    ),
    th: ({ children, node, ...p }) => <th className="border border-white/10 bg-white/[0.04] px-4 py-2 text-left font-semibold text-white" {...p}>{children}</th>,
    td: ({ children, node, ...p }) => <td className="border border-white/10 px-4 py-2 text-white/85" {...p}>{children}</td>,
    hr: ({ node, ...p }) => <hr className="my-10 border-white/10" {...p} />,
    img: ({ src, alt, node, ...p }) => {
      const s = typeof src === "string" ? src : "";
      const based = s && imageBaseUrl && !isResolved(s) ? `${imageBaseUrl}/${s.replace(/^\.\//, "")}` : s;
      // Pick the light/dark variant (default light — no-op for unsuffixed srcs),
      // then let resolveImageSrc override if provided.
      const themed = based ? resolveThemeImageSrc(based, imageTheme) : based;
      const resolved = themed && resolveImageSrc ? resolveImageSrc(themed) : themed;
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={resolved} alt={alt || ""} loading="lazy" className="my-5 max-w-full border border-white/10" {...p} />;
    },
  }), [imageBaseUrl, LinkComponent, imageTheme, resolveImageSrc]);

  return (
    <div className={className}>
      {lineSync ? (
        <style precedence="default" href="chrome-prose-sync-highlight">
          {SYNC_HIGHLIGHT_CSS}
        </style>
      ) : null}
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={
          lineSync
            ? [rehypeKatex, rehypeSlug, [rehypeSourceLine, { highlightLine }]]
            : [rehypeKatex, rehypeSlug]
        }
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
