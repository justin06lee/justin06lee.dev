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

function uniqueSlug(text: string, counts: Map<string, number>): string {
  const base = slugBase(text) || "section";
  const count = counts.get(base) ?? 0;
  counts.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

export function parseArticleSections(content: string): {
  intro: string;
  sections: ArticleSection[];
} {
  const introLines: string[] = [];
  const sectionLines = new Map<string, string[]>();
  const sections: ArticleSection[] = [];
  const slugCounts = new Map<string, number>();

  let currentSection: ArticleSection | null = null;

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^##\s+(.+)$/);

    if (match) {
      const title = match[1].trim();
      currentSection = {
        body: "",
        id: uniqueSlug(title, slugCounts),
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
