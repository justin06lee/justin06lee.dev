"use client";

import { useRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import type { Components } from "react-markdown";
import { useTheme } from "next-themes";
import { getThemeImageVariant, isThemeManagedImage } from "@/lib/theme-images";
import { CopyCodeButton } from "./CopyCodeButton";
import "katex/dist/katex.min.css";

interface MarkdownRendererProps {
  content: string;
  imageBaseUrl: string;
}

function isExternalHref(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

function isResolvedImageSrc(src: string): boolean {
  return (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:") ||
    src.startsWith("/")
  );
}

function PreBlock({ children, ...props }: React.ComponentPropsWithoutRef<"pre">) {
  const preRef = useRef<HTMLPreElement>(null);
  return (
    <pre
      ref={preRef}
      className="group relative mb-4 overflow-x-auto border border-border bg-surface-alt p-0"
      {...props}
    >
      {children}
      <CopyCodeButton codeRef={preRef} />
    </pre>
  );
}

export function MarkdownRenderer({
  content,
  imageBaseUrl,
}: MarkdownRendererProps) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";

  const paragraphIndexRef = useRef(0);
  // Reset on each render
  paragraphIndexRef.current = 0;
  const nextIndex = () => paragraphIndexRef.current++;

  const components: Components = {
    h1: ({ children, ...props }) => (
      <h1
        data-paragraph-index={nextIndex()}
        className="mb-6 mt-10 text-4xl font-normal leading-tight tracking-tight text-foreground first:mt-0"
        style={{ scrollMarginTop: "var(--sticky-header-offset)" }}
        {...props}
      >
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2
        data-paragraph-index={nextIndex()}
        className="mb-4 mt-8 text-3xl font-normal leading-snug text-foreground"
        style={{ scrollMarginTop: "var(--sticky-header-offset)" }}
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3
        data-paragraph-index={nextIndex()}
        className="mb-3 mt-6 text-2xl font-normal leading-snug text-foreground"
        style={{ scrollMarginTop: "var(--sticky-header-offset)" }}
        {...props}
      >
        {children}
      </h3>
    ),
    h4: ({ children, ...props }) => (
      <h4
        data-paragraph-index={nextIndex()}
        className="mb-2 mt-5 text-xl font-normal text-foreground"
        style={{ scrollMarginTop: "var(--sticky-header-offset)" }}
        {...props}
      >
        {children}
      </h4>
    ),
    h5: ({ children, ...props }) => (
      <h5
        data-paragraph-index={nextIndex()}
        className="mb-2 mt-4 text-lg font-normal text-foreground"
        style={{ scrollMarginTop: "var(--sticky-header-offset)" }}
        {...props}
      >
        {children}
      </h5>
    ),
    h6: ({ children, ...props }) => (
      <h6
        data-paragraph-index={nextIndex()}
        className="mb-2 mt-4 text-base font-normal text-muted"
        style={{ scrollMarginTop: "var(--sticky-header-offset)" }}
        {...props}
      >
        {children}
      </h6>
    ),
    p: ({ children, ...props }) => (
      <p data-paragraph-index={nextIndex()} className="mb-4 text-base leading-7 text-foreground" {...props}>
        {children}
      </p>
    ),
    a: ({ children, href }) => {
      const value = typeof href === "string" ? href : "";
      const className =
        "text-accent underline underline-offset-2 transition-colors hover:text-foreground";

      if (value.startsWith("/")) {
        return (
          <Link href={value} className={className}>
            {children}
          </Link>
        );
      }

      if (value.startsWith("#")) {
        return (
          <a href={value} className={className}>
            {children}
          </a>
        );
      }

      return (
        <a
          href={value || undefined}
          className={className}
          target={isExternalHref(value) ? "_blank" : undefined}
          rel={isExternalHref(value) ? "noopener noreferrer" : undefined}
        >
          {children}
        </a>
      );
    },
    ul: ({ children, ...props }) => (
      <ul data-paragraph-index={nextIndex()} className="mb-4 ml-6 list-disc space-y-1 text-foreground" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol
        data-paragraph-index={nextIndex()}
        className="mb-4 ml-6 list-decimal space-y-1 text-foreground"
        {...props}
      >
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="leading-7" {...props}>
        {children}
      </li>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote
        data-paragraph-index={nextIndex()}
        className="mb-4 border-l-4 border-accent pl-4 italic text-muted"
        {...props}
      >
        {children}
      </blockquote>
    ),
    code: ({ children, className, node, ...props }) => {
      const codeText = String(children).replace(/\n$/, "");
      const isMultiline =
        node?.position?.start.line !== undefined &&
        node.position.end.line !== undefined &&
        node.position.start.line !== node.position.end.line;
      const isBlock = className?.includes("language-") || isMultiline;

      if (isBlock) {
        return (
          <code
            className={`block overflow-x-auto bg-surface-alt p-4 font-mono text-sm leading-6 text-foreground ${className || ""}`}
            {...props}
          >
            {codeText}
          </code>
        );
      }

      return (
        <code
          className="bg-surface-alt px-1.5 py-0.5 font-mono text-sm text-foreground"
          {...props}
        >
          {children}
        </code>
      );
    },
    pre: (props) => <PreBlock {...props} data-paragraph-index={nextIndex()} />,
    table: ({ children, ...props }) => (
      <div data-paragraph-index={nextIndex()} className="mb-4 overflow-x-auto">
        <table
          className="w-full border-collapse border border-border text-sm"
          {...props}
        >
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }) => (
      <th
        className="border border-border bg-surface-alt px-4 py-2 text-left font-semibold text-foreground"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className="border border-border px-4 py-2 text-foreground" {...props}>
        {children}
      </td>
    ),
    hr: (props) => <hr data-paragraph-index={nextIndex()} className="my-8 border-border" {...props} />,
    img: ({ src, alt, ...props }) => {
      const srcStr = typeof src === "string" ? src : "";
      const themedSrc = isThemeManagedImage(srcStr)
        ? getThemeImageVariant(srcStr, theme)
        : srcStr;
      const resolvedSrc =
        themedSrc && !isResolvedImageSrc(themedSrc)
          ? `${imageBaseUrl}/${themedSrc.replace(/^\.\//, "")}`
          : themedSrc;
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          data-paragraph-index={nextIndex()}
          src={resolvedSrc}
          alt={alt || ""}
          className="my-4 max-w-full border border-border"
          loading="lazy"
          {...props}
        />
      );
    },
  };

  return (
    <div className="prose-archive max-w-none">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeSlug]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
