"use client";

import { useMemo } from "react";
import { marked } from "marked";
import { sanitizeHtml } from "@/lib/sanitize";

marked.setOptions({
  gfm: true,
  breaks: true,
});

export default function MarkdownRenderer({ content }: { content: string }) {
  const html = useMemo(() => sanitizeHtml(marked.parse(content) as string), [content]);

  return (
    <div
      className="prose-custom"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
