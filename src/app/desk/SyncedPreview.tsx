"use client";

import {
  forwardRef,
  memo,
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
  // rendered height (px) of the clicked block, so the editor can center its
  // (shorter, denser mono) matching text against this block instead of just
  // aligning the top edges -- otherwise the two highlights look vertically offset
  screenHeight: number;
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

// memo so unrelated editor state changes (e.g. clearing the text selection on
// blur) don't re-run react-markdown + KaTeX here. Each such re-render briefly
// reflowed the preview, shifting a block out from under the pointer mid-click so
// the click was lost. Requires onSelectBlock to be a stable (useCallback) ref.
export const SyncedPreview = memo(
  forwardRef<SyncedPreviewHandle, SyncedPreviewProps>(function SyncedPreview(
    { title, prerequisites, content, imageBaseUrl, onSelectBlock },
    ref
  ) {
    const scrollRef = useRef<HTMLDivElement>(null);
    // The highlighted block is driven declaratively: we hold the 1-based content
    // line and hand it to MarkdownRenderer, which stamps data-sync-highlight on the
    // matching block as it renders. Earlier this toggled a class imperatively in an
    // effect, but react-markdown rebuilds its DOM on the next render (e.g. when a
    // preview click updates the editor's state) and stranded the class, so body
    // paragraphs lost their highlight. Rendering it into the markup survives that.
    const [highlightLine, setHighlightLine] = useState<number | null>(null);

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

    const headerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      alignLineToScreenY(line: number, screenY: number) {
        const container = scrollRef.current;
        if (!container) return;
        const element = findBlockForLine(line);
        if (!element) return;
        // The "live preview" bar is sticky over the top of the scroll area, so a
        // block scrolled to a screenY inside that band lands hidden behind it.
        // Clamp the target to just below the bar so the block stays visible while
        // still sitting as close as possible to the editor selection's height.
        const containerTop = container.getBoundingClientRect().top;
        const headerBottom =
          containerTop + (headerRef.current?.offsetHeight ?? 0);
        const targetY = Math.max(screenY, headerBottom);
        // scroll the block to the target height; the browser clamps the scroll at
        // the content bounds, so near the very bottom the block lands as close as
        // it can. We do NOT move the other pane to compensate -- the pane the user
        // is looking at should stay where they put it.
        const delta = element.getBoundingClientRect().top - targetY;
        container.scrollBy({ top: delta, behavior: "smooth" });
        setHighlightLine(line);
      },
    }));

    function handleSelectBlock(event: MouseEvent<HTMLDivElement>) {
      if (!onSelectBlock) return;
      const target = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-source-line]"
      );
      if (!target) return;
      const startLine = Number(target.getAttribute("data-source-line"));
      if (!Number.isFinite(startLine)) return;
      // endLine bounds the block: it's the next tagged block's line, so the editor
      // can highlight the whole paragraph/range. Compute it by source-line VALUE
      // (smallest line greater than startLine), not by node identity -- indexOf on
      // a target that isn't in the freshly-queried list returns -1, which used to
      // collapse endLine to null and run the streak to the end of the document.
      let endLine: number | null = null;
      for (const block of sourceLineBlocks()) {
        const line = Number(block.getAttribute("data-source-line"));
        if (Number.isFinite(line) && line > startLine) {
          endLine = line;
          break;
        }
      }
      setHighlightLine(startLine);
      const targetRect = target.getBoundingClientRect();
      onSelectBlock({
        startLine,
        endLine,
        screenY: targetRect.top,
        screenHeight: targetRect.height,
      });
    }

    return (
      <div
        ref={scrollRef}
        onClick={handleSelectBlock}
        className="min-h-0 bg-black xl:h-[calc(100vh-var(--editor-offset,var(--sticky-header-offset,80px)))] xl:overflow-y-auto"
      >
        <div
          ref={headerRef}
          className="sticky top-0 z-10 border-b border-white/10 bg-black px-4 py-3 text-xs font-medium text-white/70"
        >
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
          <MarkdownRenderer
            content={content}
            imageBaseUrl={imageBaseUrl}
            lineSync
            highlightLine={highlightLine}
          />
        </div>
      </div>
    );
  })
);
