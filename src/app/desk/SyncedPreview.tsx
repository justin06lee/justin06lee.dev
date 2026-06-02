"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type MouseEvent,
} from "react";
import { MarkdownRenderer } from "@/components/article/markdown-renderer";

export interface SyncedPreviewHandle {
  // scroll the matching block for a 1-based content line to the top anchor and
  // highlight it, so it sits next to the same line in the editor pane
  scrollToLine: (line: number) => void;
}

interface SyncedPreviewProps {
  title: string;
  prerequisites: string[];
  content: string;
  imageBaseUrl: string;
  // shrinks the rendered article so more of it fits without scrolling
  scale?: number;
  // fired when the operator clicks a block, with that block's 1-based content line
  onSelectLine?: (line: number) => void;
}

// keep the synced block a little below the sticky "live preview" header
const SCROLL_ANCHOR = 16;

export const SyncedPreview = forwardRef<SyncedPreviewHandle, SyncedPreviewProps>(
  function SyncedPreview(
    { title, prerequisites, content, imageBaseUrl, scale = 0.85, onSelectLine },
    ref
  ) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const highlightedRef = useRef<HTMLElement | null>(null);

    function clearHighlight() {
      const previous = highlightedRef.current;
      if (previous) {
        previous.style.backgroundColor = "";
        previous.style.boxShadow = "";
        highlightedRef.current = null;
      }
    }

    function highlightBlock(element: HTMLElement) {
      clearHighlight();
      element.style.backgroundColor = "rgba(255,255,255,0.08)";
      element.style.boxShadow = "inset 3px 0 0 0 rgba(255,255,255,0.6)";
      highlightedRef.current = element;
    }

    // pick the last top-level block whose source line is <= the target line
    function findBlockForLine(line: number): HTMLElement | null {
      const container = scrollRef.current;
      if (!container) return null;
      const blocks = Array.from(
        container.querySelectorAll<HTMLElement>("[data-source-line]")
      );
      if (blocks.length === 0) return null;
      let best: HTMLElement | null = null;
      for (const block of blocks) {
        const blockLine = Number(block.getAttribute("data-source-line"));
        if (blockLine <= line) {
          best = block;
        } else {
          break;
        }
      }
      return best ?? blocks[0];
    }

    useImperativeHandle(ref, () => ({
      scrollToLine(line: number) {
        const container = scrollRef.current;
        if (!container) return;
        const element = findBlockForLine(line);
        if (!element) return;
        const top =
          element.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop;
        container.scrollTo({
          top: Math.max(0, top - SCROLL_ANCHOR),
          behavior: "smooth",
        });
        highlightBlock(element);
      },
    }));

    function handleClick(event: MouseEvent<HTMLDivElement>) {
      if (!onSelectLine) return;
      const target = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-source-line]"
      );
      if (!target) return;
      const line = Number(target.getAttribute("data-source-line"));
      if (!Number.isFinite(line)) return;
      highlightBlock(target);
      onSelectLine(line);
    }

    return (
      <div
        ref={scrollRef}
        onClick={handleClick}
        className="min-h-0 bg-black xl:sticky xl:h-[calc(100vh-var(--sticky-header-offset,80px))] xl:overflow-y-auto"
        style={{ top: "var(--sticky-header-offset, 80px)" }}
      >
        <div className="sticky top-0 z-10 border-b border-white/10 bg-black px-4 py-3 text-xs font-medium text-white/70">
          live preview
        </div>
        <div
          className="px-4 py-6 lg:px-8"
          style={{ zoom: scale } as React.CSSProperties}
        >
          <h1 className="mb-3 text-4xl font-semibold leading-tight tracking-tight text-white">
            {title}
          </h1>
          {prerequisites.length > 0 ? (
            <p className="mb-8 text-sm leading-6 text-white/60">
              Prerequisites: {prerequisites.join(", ")}
            </p>
          ) : null}
          <MarkdownRenderer content={content} imageBaseUrl={imageBaseUrl} lineSync />
        </div>
      </div>
    );
  }
);
