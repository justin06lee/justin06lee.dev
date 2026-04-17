"use client";

import { motion } from "motion/react";
import { CollapsibleMarkdown } from "./collapsible-markdown";
import { TableOfContents } from "./table-of-contents";

interface ArticleContentProps {
  content: string;
  imageBaseUrl?: string;
  mode: "toc" | "content";
  title?: string;
}

export function ArticleContent({
  content,
  imageBaseUrl,
  mode,
  title,
}: ArticleContentProps) {
  if (mode === "toc") {
    return <TableOfContents content={content} />;
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{ willChange: "opacity, transform" }}
    >
      {title && (
        <h1
          className="mb-8 text-5xl font-normal leading-tight tracking-tight text-foreground"
        >
          {title}
        </h1>
      )}
      <CollapsibleMarkdown
        content={content}
        imageBaseUrl={imageBaseUrl || ""}
      />
    </motion.article>
  );
}
