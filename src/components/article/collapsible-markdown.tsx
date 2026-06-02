"use client";

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
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
    <div className="max-w-none">
      {intro ? (
        <MarkdownRenderer content={intro} imageBaseUrl={imageBaseUrl} />
      ) : null}
      {sections.map((section) => (
        <details key={section.id} className="group" open>
          <summary className="flex cursor-pointer list-none items-center gap-3 py-1.5 [&::-webkit-details-marker]:hidden">
            <ChevronRight
              className="size-4 shrink-0 text-white/40 transition-transform group-hover:text-white/70 group-open:rotate-90"
              aria-hidden
            />
            <h2
              id={section.id}
              className="m-0 flex-1 text-2xl font-semibold tracking-tight text-white"
              style={{ scrollMarginTop: "var(--sticky-header-offset)" }}
            >
              {section.title}
            </h2>
          </summary>
          <div className="pl-7">
            {section.body ? (
              <MarkdownRenderer
                content={section.body}
                imageBaseUrl={imageBaseUrl}
              />
            ) : null}
          </div>
        </details>
      ))}
    </div>
  );
}
