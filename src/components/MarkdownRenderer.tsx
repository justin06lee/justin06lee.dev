"use client";

import { useMemo } from "react";
import { marked } from "marked";

// Configure marked for clean output
marked.setOptions({
  gfm: true,
  breaks: true,
});

export default function MarkdownRenderer({ content }: { content: string }) {
  const html = useMemo(() => {
    return marked.parse(content) as string;
  }, [content]);

  return (
    <div
      className="prose-custom"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
