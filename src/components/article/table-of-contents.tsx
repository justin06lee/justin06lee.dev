"use client";

import { parseArticleSections } from "@/lib/article-sections";
import { useEffect, useMemo, useState } from "react";

export function TableOfContents({ content }: { content: string }) {
  const headings = useMemo(
    () =>
      parseArticleSections(content).sections.map((section) => ({
        id: section.id,
        text: section.title,
      })),
    [content]
  );
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px" }
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav
      className="sticky overflow-y-auto"
      style={{
        maxHeight: "calc(100vh - var(--sticky-header-offset) - 2rem)",
        top: "var(--sticky-header-offset)",
      }}
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        On this page
      </p>
      <ul className="space-y-1">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`block py-1 text-sm leading-5 transition-colors ${
                activeId === h.id
                  ? "text-foreground font-medium"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
