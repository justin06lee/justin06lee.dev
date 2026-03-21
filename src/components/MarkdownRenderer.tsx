"use client";

import { useMemo } from "react";
import { marked } from "marked";

// Configure marked for clean output
marked.setOptions({
  gfm: true,
  breaks: true,
});

/** Strip all HTML tags and attributes that could execute scripts */
function sanitizeHtml(html: string): string {
  // Remove <script> tags and content
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  // Remove event handlers (onclick, onerror, onload, etc.)
  html = html.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Remove javascript: URLs
  html = html.replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'href="#"');
  html = html.replace(/src\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'src=""');
  // Remove <iframe>, <object>, <embed>, <form> tags
  html = html.replace(/<\/?(iframe|object|embed|form|base|meta|link)\b[^>]*>/gi, "");
  // Remove data: URIs in src attributes (can execute JS via SVG)
  html = html.replace(/src\s*=\s*(?:"data:[^"]*"|'data:[^']*')/gi, 'src=""');
  return html;
}

export default function MarkdownRenderer({ content }: { content: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(content) as string;
    return sanitizeHtml(raw);
  }, [content]);

  return (
    <div
      className="prose-custom"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
