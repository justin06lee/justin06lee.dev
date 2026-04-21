"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type RefObject,
} from "react";
import type { Annotation } from "@/lib/annotations";

type Props = {
  slug: string;
  annotations: Annotation[];
  isAdmin: boolean;
  children: React.ReactNode;
  onAnnotationCreated: () => void;
  onPendingMargin: (
    info: { paragraphIndex: number; position: "before" | "after" } | null,
  ) => void;
};

const HIGHLIGHT_COLORS: Record<string, string> = {
  gray: "rgba(255,255,255,0.15)",
  gold: "rgba(255,215,100,0.25)",
  amber: "rgba(200,150,50,0.25)",
};

// ---------------------------------------------------------------------------
// MarginLines – renders thin horizontal rules for margin annotations
// ---------------------------------------------------------------------------

function MarginLines({
  containerRef,
  margins,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  margins: Annotation[];
}) {
  const [lines, setLines] = useState<
    { id: string; top: number; width: number }[]
  >([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || margins.length === 0) {
      setLines([]);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const next: { id: string; top: number; width: number }[] = [];

    for (const m of margins) {
      const el = container.querySelector(
        `[data-paragraph-index="${m.paragraphIndex}"]`,
      );
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const top =
        m.position === "before"
          ? rect.top - containerRect.top - 4
          : rect.bottom - containerRect.top + 4;
      next.push({ id: m.id, top, width: rect.width });
    }

    setLines(next);
  }, [containerRef, margins]);

  return (
    <>
      {lines.map((l) => (
        <div
          key={l.id}
          className="pointer-events-none absolute left-0 border-t border-white/20"
          style={{ top: l.top, width: l.width }}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers for walking text nodes
// ---------------------------------------------------------------------------

function getTextNodes(el: Node): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) nodes.push(n as Text);
  return nodes;
}

function findParagraphElement(node: Node): HTMLElement | null {
  let cur: Node | null = node;
  while (cur && cur !== document.body) {
    if (
      cur instanceof HTMLElement &&
      cur.hasAttribute("data-paragraph-index")
    ) {
      return cur;
    }
    cur = cur.parentNode;
  }
  return null;
}

// ---------------------------------------------------------------------------
// AnnotatedContent
// ---------------------------------------------------------------------------

export default function AnnotatedContent({
  slug,
  annotations,
  isAdmin,
  children,
  onAnnotationCreated,
  onPendingMargin,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);

  const [toolbar, setToolbar] = useState<{
    x: number;
    y: number;
    paragraphIndex: number;
    startOffset: number;
    endOffset: number;
  } | null>(null);

  const [selectedColor, setSelectedColor] = useState("gray");

  const [positionPicker, setPositionPicker] = useState<{
    x: number;
    y: number;
    paragraphIndex: number;
  } | null>(null);

  // --------------------------------------------------
  // Feature 1: Apply highlight overlays
  // --------------------------------------------------

  const applyHighlights = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;

    // Remove existing marks
    container.querySelectorAll("mark[data-annotation-id]").forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    });

    const highlights = annotations.filter((a) => a.type === "highlight");

    for (const ann of highlights) {
      if (ann.startOffset == null || ann.endOffset == null) continue;

      const el = container.querySelector(
        `[data-paragraph-index="${ann.paragraphIndex}"]`,
      );
      if (!el) continue;

      const textNodes = getTextNodes(el);
      let charCount = 0;
      let startNode: Text | null = null;
      let startLocal = 0;
      let endNode: Text | null = null;
      let endLocal = 0;

      for (const tn of textNodes) {
        const len = tn.length;
        if (!startNode && charCount + len > ann.startOffset) {
          startNode = tn;
          startLocal = ann.startOffset - charCount;
        }
        if (!endNode && charCount + len >= ann.endOffset) {
          endNode = tn;
          endLocal = ann.endOffset - charCount;
          break;
        }
        charCount += len;
      }

      if (!startNode || !endNode) continue;

      try {
        const range = document.createRange();
        range.setStart(startNode, startLocal);
        range.setEnd(endNode, endLocal);

        const mark = document.createElement("mark");
        mark.setAttribute("data-annotation-id", ann.id);
        mark.style.backgroundColor =
          HIGHLIGHT_COLORS[ann.highlightColor ?? "gray"] ??
          HIGHLIGHT_COLORS.gray;
        mark.style.borderRadius = "2px";
        range.surroundContents(mark);
      } catch {
        // surroundContents can fail when the range crosses element boundaries
      }
    }
  }, [annotations]);

  useEffect(() => {
    applyHighlights();
  }, [applyHighlights]);

  // --------------------------------------------------
  // Feature 2: Text selection toolbar
  // --------------------------------------------------

  const handleMouseUp = useCallback(() => {
    if (!isAdmin) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      return;
    }

    const range = sel.getRangeAt(0);
    const paragraphEl = findParagraphElement(range.startContainer);
    if (!paragraphEl) return;

    const container = contentRef.current;
    if (!container) return;

    const idx = parseInt(
      paragraphEl.getAttribute("data-paragraph-index") ?? "-1",
      10,
    );
    if (idx < 0) return;

    // Compute character offsets within the paragraph
    const textNodes = getTextNodes(paragraphEl);
    let startOffset = 0;
    let endOffset = 0;
    let charCount = 0;

    for (const tn of textNodes) {
      if (tn === range.startContainer) {
        startOffset = charCount + range.startOffset;
      }
      if (tn === range.endContainer) {
        endOffset = charCount + range.endOffset;
        break;
      }
      charCount += tn.length;
    }

    if (endOffset <= startOffset) return;

    // Position toolbar above selection
    const selRect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    setToolbar({
      x: selRect.left + selRect.width / 2 - containerRect.left,
      y: selRect.top - containerRect.top - 8,
      paragraphIndex: idx,
      startOffset,
      endOffset,
    });
    setPositionPicker(null);
  }, [isAdmin]);

  const handleAnnotateClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!toolbar) return;

      await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleSlug: slug,
          type: "highlight",
          paragraphIndex: toolbar.paragraphIndex,
          startOffset: toolbar.startOffset,
          endOffset: toolbar.endOffset,
          highlightColor: selectedColor,
        }),
      });

      window.getSelection()?.removeAllRanges();
      setToolbar(null);
      onAnnotationCreated();
    },
    [toolbar, slug, selectedColor, onAnnotationCreated],
  );

  // --------------------------------------------------
  // Feature 3: Paragraph click -> position picker
  // --------------------------------------------------

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isAdmin) return;

      // If text is selected, don't show position picker
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;

      const target = e.target as Node;
      const paragraphEl = findParagraphElement(target);

      if (!paragraphEl) {
        setPositionPicker(null);
        onPendingMargin(null);
        return;
      }

      const container = contentRef.current;
      if (!container) return;

      const idx = parseInt(
        paragraphEl.getAttribute("data-paragraph-index") ?? "-1",
        10,
      );
      if (idx < 0) return;

      const containerRect = container.getBoundingClientRect();

      setPositionPicker({
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top,
        paragraphIndex: idx,
      });
      setToolbar(null);
    },
    [isAdmin, onPendingMargin],
  );

  // --------------------------------------------------
  // Feature 5: Escape to dismiss
  // --------------------------------------------------

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setToolbar(null);
        setPositionPicker(null);
        onPendingMargin(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onPendingMargin]);

  // --------------------------------------------------
  // Derived
  // --------------------------------------------------

  const marginAnnotations = annotations.filter((a) => a.type === "margin");

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <div
      ref={contentRef}
      className="relative"
      onMouseUp={handleMouseUp}
      onClick={handleClick}
    >
      <MarginLines containerRef={contentRef} margins={marginAnnotations} />
      {children}

      {/* Highlight toolbar */}
      {toolbar && (
        <div
          className="absolute z-30 flex items-center gap-1.5 bg-black border border-white/20 px-2 py-1.5 -translate-x-1/2 -translate-y-full"
          style={{ left: toolbar.x, top: toolbar.y }}
        >
          {Object.entries(HIGHLIGHT_COLORS).map(([name, bg]) => (
            <button
              key={name}
              type="button"
              className={`size-5 border transition ${
                selectedColor === name
                  ? "border-white scale-110"
                  : "border-white/30"
              }`}
              style={{ backgroundColor: bg }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedColor(name);
              }}
            />
          ))}
          <button
            type="button"
            className="ml-1 border border-white/40 px-2 py-0.5 text-xs text-white hover:bg-white hover:text-black transition"
            onClick={handleAnnotateClick}
          >
            annotate
          </button>
        </div>
      )}

      {/* Position picker */}
      {positionPicker && (
        <div
          className="absolute z-30 flex gap-1 bg-black border border-white/20 px-2 py-1.5"
          style={{ left: positionPicker.x, top: positionPicker.y }}
        >
          <button
            type="button"
            className="text-xs text-white/70 hover:text-white transition"
            onClick={(e) => {
              e.stopPropagation();
              onPendingMargin({
                paragraphIndex: positionPicker.paragraphIndex,
                position: "before",
              });
              setPositionPicker(null);
            }}
          >
            &uarr; above
          </button>
          <button
            type="button"
            className="text-xs text-white/70 hover:text-white transition"
            onClick={(e) => {
              e.stopPropagation();
              onPendingMargin({
                paragraphIndex: positionPicker.paragraphIndex,
                position: "after",
              });
              setPositionPicker(null);
            }}
          >
            &darr; below
          </button>
        </div>
      )}
    </div>
  );
}
