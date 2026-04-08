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
  // Remove <style> tags and content (CSS-based data exfiltration)
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  // Remove event handlers (onclick, onerror, onload, etc.) — handle whitespace/encoding variants
  html = html.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "");
  // Remove javascript:/vbscript:/data: in href and src (any quoting style)
  html = html.replace(/(href|src|action|formaction)\s*=\s*(?:"(?:javascript|vbscript|data):[^"]*"|'(?:javascript|vbscript|data):[^']*'|(?:javascript|vbscript|data):[^\s>]*)/gi, '$1=""');
  // Remove dangerous tags: iframe, object, embed, form, base, meta, link, svg, math
  html = html.replace(/<\/?(iframe|object|embed|form|base|meta|link|svg|math)\b[^>]*>/gi, "");
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
