"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type {
  PreviewBlockSelection,
  EditorPreviewHandle,
} from "@/components/chrome/editor-preview";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** 1-based source line containing char `offset`. */
export function offsetToLine(text: string, offset: number): number {
  return text.slice(0, clamp(offset, 0, text.length)).split("\n").length;
}

/** Char offset where 1-based `line` begins (clamps past the end to text length). */
export function lineStartOffset(text: string, line: number): number {
  if (line <= 1) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") {
      seen += 1;
      if (seen === line - 1) return i + 1;
    }
  }
  return text.length;
}

/**
 * Char-offset range for a clicked preview block, given its 1-based `startLine`
 * and the next block's `startLine` as `endLine` (or null when it's the last
 * block). Trailing blank lines are trimmed so the streak covers only the block's
 * text — not the blank separator or the next block's fence/heading — and the end
 * sits before the final newline so the streak's bottom lands on the last text row.
 */
export function trimStreakRange(
  text: string,
  startLine: number,
  endLine: number | null,
): { start: number; end: number } {
  const start = lineStartOffset(text, startLine);
  const lines = text.split("\n");
  let lastLine = endLine == null ? lines.length : endLine - 1;
  while (lastLine > startLine && (lines[lastLine - 1] ?? "").trim() === "") {
    lastLine -= 1;
  }
  let end = lineStartOffset(text, lastLine + 1);
  if (end > start && text[end - 1] === "\n") end -= 1;
  return { start, end: Math.max(start, end) };
}

// --- pixel measurement (mirror-div technique) --------------------------------

export interface SelectionRect {
  /** pixels from the top of the textarea's content (caret coords, scroll-agnostic) */
  top: number;
  height: number;
}

/** vertical breathing room (px) added above/below the editor's gray streak */
export const STREAK_PAD = 3;

// computed-style props the mirror div must copy so its text wraps exactly like
// the textarea (same font metrics + wrapping rules => same line breaks)
const MIRROR_STYLE_PROPS = [
  "boxSizing",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontVariant",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "textIndent",
  "whiteSpace",
  "wordSpacing",
  "tabSize",
] as const;

// Build a hidden div that wraps text exactly like the textarea, then read the
// pixel top of the line containing `position`. Putting the *remaining* text in
// the measured span keeps the line breaks after `position` identical to the
// textarea. (The classic textarea-caret-position technique.)
function measureCaretTop(
  textarea: HTMLTextAreaElement,
  computed: CSSStyleDeclaration,
  position: number,
): number {
  const doc = textarea.ownerDocument;
  const div = doc.createElement("div");
  const style = div.style;
  for (const prop of MIRROR_STYLE_PROPS) {
    style[prop] = computed[prop];
  }
  style.position = "absolute";
  style.top = "-9999px";
  style.left = "-9999px";
  style.visibility = "hidden";
  style.overflow = "hidden";
  style.height = "auto";
  // clientWidth excludes any scrollbar, so wrapping matches what the user sees;
  // border-box + copied padding then reproduces the exact content width
  style.boxSizing = "border-box";
  style.width = `${textarea.clientWidth}px`;
  style.borderWidth = "0";

  const value = textarea.value;
  div.textContent = value.slice(0, position);
  const span = doc.createElement("span");
  // trailing "." so a position at the very end still produces a laid-out box
  span.textContent = value.slice(position) || ".";
  div.appendChild(span);

  doc.body.appendChild(div);
  // offsetTop is measured from the offsetParent's padding edge (inside the
  // border), so add the textarea's top border to land in its border-box space,
  // which is where the absolutely-positioned overlay/button live.
  const borderTop = parseFloat(computed.borderTopWidth) || 0;
  const top = span.offsetTop + borderTop;
  doc.body.removeChild(div);
  return top;
}

// A textarea can't report caret pixel coordinates, and its lines soft-wrap, so
// line-number * line-height is wrong. Measure the selection's start and end rows
// via the mirror div. Returns content-space coords; subtract scrollTop for the
// viewport position.
function measureSelectionRect(
  textarea: HTMLTextAreaElement,
  start: number,
  end: number,
): SelectionRect | null {
  const computed = window.getComputedStyle(textarea);
  const lineHeight = parseFloat(computed.lineHeight) || 24;
  const top = measureCaretTop(textarea, computed, start);
  const endTop = end > start ? measureCaretTop(textarea, computed, end) : top;
  return { top, height: Math.max(lineHeight, endTop + lineHeight - top) };
}

// --- the engine hook ---------------------------------------------------------

export interface UseLineSyncOptions {
  /** The markdown source being edited. */
  value: string;
}

export interface UseLineSyncReturn {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  previewRef: RefObject<EditorPreviewHandle | null>;
  overlayLayerRef: RefObject<HTMLDivElement | null>;
  editorScrollTopRef: RefObject<number>;
  /** Pixel rect of the gray streak, or null. */
  syncedRect: SelectionRect | null;
  /** Live non-empty selection, or null (drives the floating sync button). */
  selection: { start: number; end: number } | null;
  /** Pixel rect of the selection (for placing the button), or null. */
  selectionRect: SelectionRect | null;
  /** Fire the editor-to-preview sync (call from the floating button). */
  syncToPreview: () => void;
  /** Handler for a preview block click (pass to EditorPreview's onSelectBlock). */
  onPreviewSelectBlock: (selection: PreviewBlockSelection) => void;
  /** Refresh the tracked selection (pass to the textarea's onSelect/onMouseUp). */
  refreshSelection: () => void;
  /** Clear the selection (pass to the textarea's onBlur). */
  clearSelection: () => void;
  /** Track the textarea's internal scroll so the overlay follows (onScroll). */
  handleScroll: (scrollTop: number) => void;
}

/**
 * Bidirectional editor ↔ preview sync engine. Owns the caret↔line math, the
 * pixel measurement, the overlay scroll-follow, and the two-way coordination.
 * Pair it with a `<textarea>` and a `<EditorPreview>` (see editor.tsx).
 */
export function useLineSync({ value }: UseLineSyncOptions): UseLineSyncReturn {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<EditorPreviewHandle>(null);
  const overlayLayerRef = useRef<HTMLDivElement>(null);
  const editorScrollTopRef = useRef(0);

  // Live non-empty selection the floating sync button acts on. char offsets.
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  // The synced range shown as a persistent gray streak (set on either sync).
  const [syncedRange, setSyncedRange] = useState<{ start: number; end: number } | null>(null);
  // Pixel rects measured via the mirror div; recomputed when range/text change,
  // not on every scroll frame. measureNonce lets a resize force a re-measure.
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [syncedRect, setSyncedRect] = useState<SelectionRect | null>(null);
  const [measureNonce, setMeasureNonce] = useState(0);

  const handleScroll = useCallback((scrollTop: number) => {
    editorScrollTopRef.current = scrollTop;
    if (overlayLayerRef.current) {
      overlayLayerRef.current.style.transform = `translateY(${-scrollTop}px)`;
    }
  }, []);

  const refreshSelection = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd } = textarea;
    setSelection(selectionStart === selectionEnd ? null : { start: selectionStart, end: selectionEnd });
  }, []);

  const clearSelection = useCallback(() => setSelection(null), []);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !selection) {
      setSelectionRect(null);
      return;
    }
    setSelectionRect(measureSelectionRect(textarea, selection.start, selection.end));
  }, [selection, value, measureNonce]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !syncedRange) {
      setSyncedRect(null);
      return;
    }
    setSyncedRect(measureSelectionRect(textarea, syncedRange.start, syncedRange.end));
  }, [syncedRange, value, measureNonce]);

  useEffect(() => {
    function onResize() {
      setMeasureNonce((n) => n + 1);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // editor -> preview: scroll the matching preview block to the same viewport
  // height as the selection and leave a gray streak. The editor stays put.
  const syncToPreview = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || !selection) return;
    const rect = selectionRect ?? measureSelectionRect(textarea, selection.start, selection.end);
    if (!rect) return;
    const screenY = textarea.getBoundingClientRect().top + rect.top - textarea.scrollTop;
    // The editor text *is* the rendered source, so the editor line is the
    // content line directly (no title/metadata header offset to subtract).
    const line = offsetToLine(value, selection.start);
    previewRef.current?.alignLineToScreenY(line, screenY);
    setSyncedRange({ start: selection.start, end: selection.end });
    // swap the native selection for our gray streak; keep focus + caret
    textarea.setSelectionRange(selection.start, selection.start);
    setSelection(null);
  }, [selection, selectionRect, value]);

  // preview -> editor: scroll the editor so the matching text lands level with
  // the clicked block, and lay a gray streak over the block's lines.
  const onPreviewSelectBlock = useCallback(
    ({ startLine, endLine, screenY, screenHeight }: PreviewBlockSelection) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const { start, end } = trimStreakRange(value, startLine, endLine);
      setSyncedRange({ start, end });
      const rect = measureSelectionRect(textarea, start, end);
      if (!rect) return;
      const taTop = textarea.getBoundingClientRect().top;
      // line the block's CENTER up with the clicked preview block's center (not
      // just top edges): the editor's mono text is denser than the preview's
      // prose, so equal blocks have different heights; centering keeps the two
      // highlights visually level.
      const aligned = rect.top - (screenY - taTop) + (rect.height - screenHeight) / 2;
      // but if that would push the block's last line below the editor, pull it up
      // so its bottom rests at the editor's bottom. Capped so the first line never
      // scrolls past the top.
      const endAtBottom = rect.top + rect.height - textarea.clientHeight;
      const target = Math.min(Math.max(aligned, endAtBottom), rect.top);
      textarea.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    },
    [value],
  );

  return {
    textareaRef,
    previewRef,
    overlayLayerRef,
    editorScrollTopRef,
    syncedRect,
    selection,
    selectionRect,
    syncToPreview,
    onPreviewSelectBlock,
    refreshSelection,
    clearSelection,
    handleScroll,
  };
}
