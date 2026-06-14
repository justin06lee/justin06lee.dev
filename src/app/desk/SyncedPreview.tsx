"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { MarkdownRenderer } from "@/components/article/markdown-renderer";

export interface PreviewBlockSelection {
  // 1-based content line where the clicked block starts
  startLine: number;
  // 1-based content line where the next block starts (exclusive end), or null
  // when the clicked block is the last one
  endLine: number | null;
  // viewport y (px) of the clicked block's top edge, so the editor can scroll
  // its matching text to the same height
  screenY: number;
}

export interface SyncedPreviewHandle {
  // Scroll the block for a 1-based content line so its top edge lands at
  // `screenY` (a viewport coordinate), putting it level with the editor
  // selection it was triggered from, then highlight it.
  alignLineToScreenY: (line: number, screenY: number) => void;
}

interface SyncedPreviewProps {
  title: string;
  prerequisites: string[];
  content: string;
  imageBaseUrl: string;
  // fired when the operator clicks a block in the preview
  onSelectBlock?: (selection: PreviewBlockSelection) => void;
}

export const SyncedPreview = forwardRef<SyncedPreviewHandle, SyncedPreviewProps>(
  function SyncedPreview(
    { title, prerequisites, content, imageBaseUrl, onSelectBlock },
    ref
  ) {
    const scrollRef = useRef<HTMLDivElement>(null);
    // Highlight is React state, not a stashed DOM node: the preview re-renders on
    // every keystroke, which would leave an imperatively-styled node detached and
    // the highlight stranded on the wrong block. `nonce` lets the same line be
    // re-selected (it changes object identity so the effect re-fires).
    const [highlight, setHighlight] = useState<{
      line: number;
      nonce: number;
    } | null>(null);
    const nonceRef = useRef(0);

    function requestHighlight(line: number) {
      nonceRef.current += 1;
      setHighlight({ line, nonce: nonceRef.current });
    }

    function sourceLineBlocks(): HTMLElement[] {
      const container = scrollRef.current;
      if (!container) return [];
      return Array.from(
        container.querySelectorAll<HTMLElement>("[data-source-line]")
      );
    }

    // pick the last top-level block whose source line is <= the target line
    function findBlockForLine(line: number): HTMLElement | null {
      const blocks = sourceLineBlocks();
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
      alignLineToScreenY(line: number, screenY: number) {
        const container = scrollRef.current;
        if (!container) return;
        const element = findBlockForLine(line);
        if (!element) return;
        // scroll the block from where it is now to the editor selection's height
        const delta = element.getBoundingClientRect().top - screenY;
        container.scrollBy({ top: delta, behavior: "smooth" });
        requestHighlight(line);
      },
    }));

    // Apply the highlight class to the matching block. Re-runs on `content` so a
    // re-render (typing) re-applies it to the fresh DOM node instead of leaving
    // it stranded; cleanup pulls it off the previous node. The highlight persists
    // (no auto-clear) until the next sync replaces it.
    useEffect(() => {
      if (!highlight) return;
      const element = findBlockForLine(highlight.line);
      if (!element) return;
      element.classList.add("sync-highlight");
      return () => element.classList.remove("sync-highlight");
      // findBlockForLine reads the DOM fresh each call; content is the meaningful
      // re-query trigger, so it is intentionally the only extra dependency.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlight, content]);

    function handleClick(event: MouseEvent<HTMLDivElement>) {
      if (!onSelectBlock) return;
      const target = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-source-line]"
      );
      if (!target) return;
      const startLine = Number(target.getAttribute("data-source-line"));
      if (!Number.isFinite(startLine)) return;
      // the next tagged block's line bounds this block, so the editor can
      // highlight the whole paragraph/range rather than a single line
      const blocks = sourceLineBlocks();
      const index = blocks.indexOf(target);
      const next = index >= 0 ? blocks[index + 1] : undefined;
      const endLine = next
        ? Number(next.getAttribute("data-source-line"))
        : null;
      requestHighlight(startLine);
      onSelectBlock({
        startLine,
        endLine: Number.isFinite(endLine as number) ? endLine : null,
        screenY: target.getBoundingClientRect().top,
      });
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
        <div className="px-4 py-6 lg:px-8">
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
