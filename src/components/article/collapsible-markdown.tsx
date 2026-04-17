"use client";

import { useMemo } from "react";
import { parseArticleSections } from "@/lib/article-sections";
import { MarkdownRenderer } from "./markdown-renderer";

interface CollapsibleMarkdownProps {
  content: string;
  imageBaseUrl: string;
}

export function CollapsibleMarkdown({
  content,
  imageBaseUrl,
}: CollapsibleMarkdownProps) {
  const { intro, sections } = useMemo(
    () => parseArticleSections(content),
    [content]
  );

  if (sections.length === 0) {
    return <MarkdownRenderer content={content} imageBaseUrl={imageBaseUrl} />;
  }

  return (
    <div className="prose-archive max-w-none">
      {intro ? (
        <MarkdownRenderer content={intro} imageBaseUrl={imageBaseUrl} />
      ) : null}
      {sections.map((section) => {
        return (
          <details
            key={section.id}
            open
            className="group py-1"
          >
            <summary className="flex cursor-pointer list-none items-start gap-3 py-2 [&::-webkit-details-marker]:hidden">
              <span
                className="mt-2 inline-flex h-5 w-5 shrink-0 items-center justify-center text-[11px] text-muted/80 transition-transform group-open:rotate-90 group-hover:text-muted"
                aria-hidden
              >
                &#9654;
              </span>
              <h2
                id={section.id}
                className="mb-0 mt-0 flex-1 text-3xl font-normal leading-snug text-foreground"
                style={{ scrollMarginTop: "var(--sticky-header-offset)" }}
              >
                {section.title}
              </h2>
            </summary>
            <div className="pl-8">
              {section.body ? (
                <MarkdownRenderer
                  content={section.body}
                  imageBaseUrl={imageBaseUrl}
                />
              ) : null}
            </div>
          </details>
        );
      })}
    </div>
  );
}
