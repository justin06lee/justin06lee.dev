export interface ParsedArticleDraft {
  content: string;
  cover: string | null;
  excerpt: string | null;
  prerequisites: string[];
  tags: string[];
  title: string;
}

export function normalizePrerequisitePath(filepath: string): string {
  return filepath
    .replace(/^\//, "")
    .replace(/\/notes\.md$/i, "")
    .replace(/\/+/g, "/");
}

export function trimBlankEdges(lines: string[]): string {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start]?.trim() === "") {
    start += 1;
  }

  while (end > start && lines[end - 1]?.trim() === "") {
    end -= 1;
  }

  return lines.slice(start, end).join("\n");
}

// Number of raw lines (title + metadata + blank edges) that precede the parsed
// body. The editor uses this to convert a textarea line into a body line for
// preview sync. `content` is `parseArticleDraft(raw).content` (already LF + blank
// edges trimmed); `raw` must be normalized to LF by the caller.
//
// We match `content` only at a line boundary: a bare indexOf can land on a
// mid-line occurrence (e.g. the body's first line text also appearing inside the
// title or a metadata value), which would shift every mapped line and sync to the
// wrong block. Returns 0 if the body can't be located.
export function bodyLineOffset(raw: string, content: string): number {
  if (!content) return 0;
  let index = raw.indexOf(content);
  while (index > 0 && raw[index - 1] !== "\n") {
    index = raw.indexOf(content, index + 1);
  }
  if (index < 0) return 0;
  return raw.slice(0, index).split("\n").length - 1;
}

export function parseArticleDraft(
  raw: string,
  fallbackTitle: string
): ParsedArticleDraft {
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/);
  let cursor = 0;
  let title = fallbackTitle;
  let cover: string | null = null;
  let excerpt: string | null = null;
  const tags: string[] = [];
  const prerequisites: string[] = [];
  const seenPrereqs = new Set<string>();

  while (cursor < lines.length && lines[cursor]?.trim() === "") {
    cursor += 1;
  }

  const titleMatch = lines[cursor]?.match(/^#\s+(.+)$/);
  if (titleMatch) {
    title = titleMatch[1].trim();
    cursor += 1;
  }

  while (cursor < lines.length) {
    const line = lines[cursor]?.trim() ?? "";

    if (line === "") {
      cursor += 1;
      continue;
    }

    const coverMatch = line.match(/^cover:\s*(.+)$/i);
    if (coverMatch) {
      let raw = coverMatch[1].trim();
      const mdImg = raw.match(/^!\[.*?\]\((.+?)\)$/);
      if (mdImg) raw = mdImg[1];
      cover = raw;
      cursor += 1;
      continue;
    }

    const excerptMatch = line.match(/^excerpt:\s*(.+)$/i);
    if (excerptMatch) {
      excerpt = excerptMatch[1].trim();
      cursor += 1;
      continue;
    }

    const tagsMatch = line.match(/^tags:\s*(.+)$/i);
    if (tagsMatch) {
      for (const tag of tagsMatch[1].split(",")) {
        const t = tag.trim();
        if (t) tags.push(t);
      }
      cursor += 1;
      continue;
    }

    const prerequisitesMatch = line.match(/^prerequisites:\s*(.*)$/i);
    if (prerequisitesMatch) {
      for (const item of prerequisitesMatch[1].split(",")) {
        const normalized = normalizePrerequisitePath(item.trim());
        if (!normalized || seenPrereqs.has(normalized)) continue;
        prerequisites.push(normalized);
        seenPrereqs.add(normalized);
      }
      cursor += 1;
      continue;
    }

    break;
  }

  return {
    content: trimBlankEdges(lines.slice(cursor)),
    cover,
    excerpt,
    prerequisites,
    tags,
    title,
  };
}

export function buildArticleDraft({
  content,
  cover,
  excerpt,
  prerequisites = [],
  tags = [],
  title,
}: {
  content?: string;
  cover?: string | null;
  excerpt?: string | null;
  prerequisites?: string[];
  tags?: string[];
  title: string;
}): string {
  const normalizedPrerequisites = prerequisites
    .map((item) => normalizePrerequisitePath(item.trim()))
    .filter(Boolean);

  const sections = [`# ${title.trim() || "Untitled"}`];

  if (cover) {
    sections.push(`cover: ${cover}`);
  }

  if (excerpt) {
    sections.push(`excerpt: ${excerpt}`);
  }

  if (tags.length > 0) {
    sections.push(`tags: ${tags.join(", ")}`);
  }

  if (normalizedPrerequisites.length > 0) {
    sections.push(`Prerequisites: ${normalizedPrerequisites.join(", ")}`);
  }

  sections.push("");

  if (content && content.trim().length > 0) {
    sections.push(trimBlankEdges(content.split(/\r?\n/)));
  } else {
    sections.push("Start writing here.");
  }

  return sections.join("\n");
}
