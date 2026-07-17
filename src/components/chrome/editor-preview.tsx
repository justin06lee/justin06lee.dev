"use client";

import {
  forwardRef,
  memo,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export interface PreviewBlockSelection {
  /** 1-based source line where the clicked block starts. */
  startLine: number;
  /**
   * 1-based source line where the next block starts (exclusive end), or null
   * when the clicked block is the last one.
   */
  endLine: number | null;
  /**
   * Viewport y (px) of the clicked block's top edge, so an editor can scroll its
   * matching text to the same height.
   */
  screenY: number;
  /**
   * Rendered height (px) of the clicked block, so an editor can center its
   * (shorter, denser mono) matching text against this block instead of just
   * aligning top edges — otherwise the two highlights look vertically offset.
   */
  screenHeight: number;
}

export interface EditorPreviewHandle {
  /**
   * Scroll the block for a 1-based source line so its top edge lands at
   * `screenY` (a viewport coordinate), putting it level with the editor
   * selection it was triggered from, then highlight it.
   */
  alignLineToScreenY: (line: number, screenY: number) => void;
}

export interface EditorPreviewProps {
  /** Markdown source rendered through `renderMarkdown`. */
  content: string;
  /**
   * Renders the markdown with line-sync enabled and the current highlight line
   * applied — typically `(md, { highlightLine }) =>
   * <Prose lineSync highlightLine={highlightLine}>{md}</Prose>`. The renderer
   * MUST stamp `data-source-line` on top-level blocks (and `data-sync-highlight`
   * on the highlighted one) for sync to work.
   */
  renderMarkdown: (
    markdown: string,
    state: { highlightLine: number | null },
  ) => ReactNode;
  /** Fired when the user clicks a block in the preview. */
  onSelectBlock?: (selection: PreviewBlockSelection) => void;
  /** Optional sticky label shown over the top of the scroll area. */
  label?: ReactNode;
  className?: string;
}

// memo so unrelated editor state changes (e.g. clearing a text selection on
// blur) don't re-run the markdown renderer here. Each such re-render briefly
// reflows the preview, shifting a block out from under the pointer mid-click so
// the click is lost. Requires onSelectBlock to be a stable (useCallback) ref.
export const EditorPreview = memo(
  forwardRef<EditorPreviewHandle, EditorPreviewProps>(function EditorPreview(
    { content, renderMarkdown, onSelectBlock, label = "live preview", className },
    ref,
  ) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    // The highlighted block is driven declaratively: we hold the 1-based source
    // line and hand it to the renderer, which stamps data-sync-highlight on the
    // matching block as it renders. An imperatively-toggled class would get wiped
    // when the renderer rebuilds its DOM on the next render; rendering it into the
    // markup survives that.
    const [highlightLine, setHighlightLine] = useState<number | null>(null);

    function sourceLineBlocks(): HTMLElement[] {
      const container = scrollRef.current;
      if (!container) return [];
      return Array.from(
        container.querySelectorAll<HTMLElement>("[data-source-line]"),
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
      return best ?? blocks[0] ?? null;
    }

    useImperativeHandle(ref, () => ({
      alignLineToScreenY(line: number, screenY: number) {
        const container = scrollRef.current;
        if (!container) return;
        const element = findBlockForLine(line);
        if (!element) return;
        // The label bar is sticky over the top of the scroll area, so a block
        // scrolled to a screenY inside that band lands hidden behind it. Clamp
        // the target to just below the bar so the block stays visible while still
        // sitting as close as possible to the editor selection's height.
        const containerTop = container.getBoundingClientRect().top;
        const headerBottom =
          containerTop + (headerRef.current?.offsetHeight ?? 0);
        const targetY = Math.max(screenY, headerBottom);
        // scroll the block to the target height; the browser clamps the scroll at
        // the content bounds, so near the very bottom the block lands as close as
        // it can. We do NOT move the other pane to compensate — the pane the user
        // is looking at should stay where they put it.
        const delta = element.getBoundingClientRect().top - targetY;
        container.scrollBy({ top: delta, behavior: "smooth" });
        setHighlightLine(line);
      },
    }));

    function handleSelectBlock(event: MouseEvent<HTMLDivElement>) {
      const target = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-source-line]",
      );
      if (!target) return;
      const startLine = Number(target.getAttribute("data-source-line"));
      if (!Number.isFinite(startLine)) return;
      // endLine bounds the block: the next tagged block's line, so an editor can
      // highlight the whole paragraph/range. Compute it by source-line VALUE
      // (smallest line greater than startLine), not node identity.
      let endLine: number | null = null;
      for (const block of sourceLineBlocks()) {
        const line = Number(block.getAttribute("data-source-line"));
        if (Number.isFinite(line) && line > startLine) {
          endLine = line;
          break;
        }
      }
      setHighlightLine(startLine);
      if (!onSelectBlock) return;
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
        className={cn("min-h-0 overflow-y-auto bg-black", className)}
      >
        {label != null ? (
          <div
            ref={headerRef}
            className="sticky top-0 z-10 border-b border-white/10 bg-black px-4 py-3 text-xs font-medium text-white/70"
          >
            {label}
          </div>
        ) : null}
        <div className="px-4 py-6 lg:px-8">
          {renderMarkdown(content, { highlightLine })}
        </div>
      </div>
    );
  }),
);
