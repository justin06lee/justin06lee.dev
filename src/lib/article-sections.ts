import { trimBlankEdges } from "./article-draft";

export interface ArticleSection {
  body: string;
  id: string;
  title: string;
}

function slugBase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// disambiguate against every id already emitted, not just the base slug's
// count: a title literally named "section-1" would otherwise collide with the
// suffix generated for a duplicate "section", silently overwriting its body.
// Numbering follows the conventional base, base-1, base-2 sequence.
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

export function parseArticleSections(content: string): {
  intro: string;
  sections: ArticleSection[];
} {
  const introLines: string[] = [];
  const sectionLines = new Map<string, string[]>();
  const sections: ArticleSection[] = [];
  const usedIds = new Set<string>();

  let currentSection: ArticleSection | null = null;

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^##\s+(.+)$/);

    if (match) {
      const title = match[1].trim();
      currentSection = {
        body: "",
        id: uniqueSlug(title, usedIds),
        title,
      };
      sections.push(currentSection);
      sectionLines.set(currentSection.id, []);
      continue;
    }

    if (!currentSection) {
      introLines.push(line);
      continue;
    }

    sectionLines.get(currentSection.id)?.push(line);
  }

  for (const section of sections) {
    section.body = trimBlankEdges(sectionLines.get(section.id) ?? []);
  }

  return {
    intro: trimBlankEdges(introLines),
    sections,
  };
}
