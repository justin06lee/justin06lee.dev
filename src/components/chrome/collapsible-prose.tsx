"use client";

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CollapsibleProseProps = {
  /** Markdown source. Split into collapsible sections on each `##` heading. */
  children: string;
  /**
   * Renders a markdown string to React. Keeps the renderer your choice —
   * typically `(md) => <Prose>{md}</Prose>`.
   */
  renderMarkdown: (markdown: string) => React.ReactNode;
  /** Whether sections start expanded. Default true. */
  defaultOpen?: boolean;
  className?: string;
};

type Section = { id: string; title: string; body: string };

function slugBase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// Disambiguate against every id already emitted, not just the base slug's count:
// a title literally named "section-1" would otherwise collide with the suffix
// generated for a duplicate "section", silently overwriting its body. Numbering
// follows the conventional base, base-1, base-2 sequence.
function uniqueSlug(text: string, usedIds: Set<string>): string {
  const base = slugBase(text) || "section";
  let id = base;
  let counter = 0;
  while (usedIds.has(id)) {
    counter += 1;
    id = `${base}-${counter}`;
  }
  usedIds.add(id);
  return id;
}

function trimBlankEdges(lines: string[]): string {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start]!.trim() === "") start++;
  while (end > start && lines[end - 1]!.trim() === "") end--;
  return lines.slice(start, end).join("\n");
}

/** Split markdown into an intro (before the first `##`) plus one section per `##` heading. */
function parseSections(content: string): { intro: string; sections: Section[] } {
  const introLines: string[] = [];
  const sectionLines = new Map<string, string[]>();
  const sections: Section[] = [];
  const usedIds = new Set<string>();
  let current: Section | null = null;

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      const title = match[1]!.trim();
      current = { id: uniqueSlug(title, usedIds), title, body: "" };
      sections.push(current);
      sectionLines.set(current.id, []);
      continue;
    }
    if (!current) {
      introLines.push(line);
      continue;
    }
    sectionLines.get(current.id)?.push(line);
  }

  for (const section of sections) {
    section.body = trimBlankEdges(sectionLines.get(section.id) ?? []);
  }
  return { intro: trimBlankEdges(introLines), sections };
}

/**
 * Markdown reading layout where each `##` heading becomes a collapsible
 * `<details>` section with a rotating chevron — matches justin06lee.dev's
 * long-form articles. Content before the first `##` renders as a plain intro.
 * Bring your own renderer via `renderMarkdown` (typically the `prose` component).
 */
export function CollapsibleProse({
  children,
  renderMarkdown,
  defaultOpen = true,
  className,
}: CollapsibleProseProps) {
  const { intro, sections } = useMemo(() => parseSections(children), [children]);

  // No headings to split on — fall back to a flat render.
  if (sections.length === 0) {
    return <div className={cn("max-w-none", className)}>{renderMarkdown(children)}</div>;
  }

  return (
    <div className={cn("max-w-none", className)}>
      {intro ? renderMarkdown(intro) : null}
      {sections.map((section) => (
        <details key={section.id} className="group" open={defaultOpen}>
          <summary className="flex cursor-pointer list-none items-center gap-3 py-1.5 [&::-webkit-details-marker]:hidden">
            <ChevronRight
              className="size-4 shrink-0 text-white/40 transition-transform group-hover:text-white/70 group-open:rotate-90"
              aria-hidden
            />
            <h2
              id={section.id}
              className="m-0 flex-1 text-2xl font-semibold tracking-tight text-white"
              style={{ scrollMarginTop: "var(--sticky-header-offset, 80px)" }}
            >
              {section.title}
            </h2>
          </summary>
          <div className="pl-7">{section.body ? renderMarkdown(section.body) : null}</div>
        </details>
      ))}
    </div>
  );
}
