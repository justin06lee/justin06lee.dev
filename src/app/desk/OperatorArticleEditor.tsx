"use client";

import Image from "next/image";
import Link from "next/link";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { bodyLineOffset, parseArticleDraft } from "@/lib/article-draft";
import { routeForPath } from "@/lib/github";
import type { OperatorImageAsset } from "@/lib/operator-content";
import { getThemeImageVariant } from "@/lib/theme-images";
import { useTheme } from "next-themes";
import { OperatorDrawingWindow } from "./OperatorDrawingWindow";
import {
  SyncedPreview,
  type SyncedPreviewHandle,
  type PreviewBlockSelection,
} from "./SyncedPreview";
import {
  deleteImageAction,
  saveArticleAction,
  type OperatorFormState,
} from "./content-actions";

type EditorMode = "edit" | "preview" | "split";
type VimMode = "insert" | "normal";

interface DrawingWindowState {
  id: number;
  position: { x: number; y: number };
}

interface ToolbarAction {
  after?: string;
  before: string;
  label: string;
  placeholder?: string;
}

const VIM_STORAGE_KEY = "operator-editor-vim";

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  {
    label: "H2",
    before: "\n## ",
    placeholder: "Section Title",
  },
  {
    label: "Bold",
    before: "**",
    after: "**",
    placeholder: "bold text",
  },
  {
    label: "List",
    before: "\n- ",
    placeholder: "List item",
  },
  {
    label: "Code",
    before: "\n```txt\n",
    after: "\n```\n",
    placeholder: "code",
  },
  {
    label: "Link",
    before: "[",
    after: "](https://example.com)",
    placeholder: "label",
  },
  {
    label: "Math",
    before: "\n$$\n",
    after: "\n$$\n",
    placeholder: "x^2 + y^2 = z^2",
  },
];

function getStoredVimEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(VIM_STORAGE_KEY) === "1";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getNextDrawingWindowId(windows: DrawingWindowState[]): number {
  const ids = new Set(windows.map((window) => window.id));
  let nextId = 1;

  while (ids.has(nextId)) {
    nextId += 1;
  }

  return nextId;
}

function normalizeNormalCursor(text: string, index: number): number {
  if (text.length === 0) {
    return 0;
  }

  return clamp(index, 0, text.length - 1);
}

function getLineStart(text: string, index: number): number {
  let cursor = clamp(index, 0, text.length);

  while (cursor > 0 && text[cursor - 1] !== "\n") {
    cursor -= 1;
  }

  return cursor;
}

function getLineEnd(text: string, index: number): number {
  let cursor = clamp(index, 0, text.length);

  while (cursor < text.length && text[cursor] !== "\n") {
    cursor += 1;
  }

  return cursor;
}

function getLineLastCharacter(text: string, index: number): number {
  const start = getLineStart(text, index);
  const end = getLineEnd(text, index);
  return end > start ? end - 1 : start;
}

function getCurrentColumn(text: string, index: number): number {
  return clamp(index, 0, text.length) - getLineStart(text, index);
}

function getFirstNonWhitespace(text: string, index: number): number {
  const start = getLineStart(text, index);
  const end = getLineEnd(text, index);
  let cursor = start;

  while (cursor < end && /\s/.test(text[cursor] ?? "")) {
    cursor += 1;
  }

  return cursor < end ? cursor : start;
}

function moveVertical(
  text: string,
  index: number,
  direction: -1 | 1,
  preferredColumn?: number | null
): { column: number; index: number } {
  if (text.length === 0) {
    return { column: 0, index: 0 };
  }

  const currentStart = getLineStart(text, index);
  const targetColumn = preferredColumn ?? getCurrentColumn(text, index);

  if (direction === -1) {
    if (currentStart === 0) {
      return { column: targetColumn, index };
    }

    const previousLineEnd = currentStart - 1;
    const previousLineStart = getLineStart(text, previousLineEnd);
    const previousLineLength = getLineEnd(text, previousLineStart) - previousLineStart;
    const targetIndex =
      previousLineLength > 0
        ? previousLineStart + Math.min(targetColumn, previousLineLength - 1)
        : previousLineStart;

    return { column: targetColumn, index: targetIndex };
  }

  const currentLineEnd = getLineEnd(text, index);
  if (currentLineEnd >= text.length) {
    return { column: targetColumn, index };
  }

  const nextLineStart = currentLineEnd + 1;
  const nextLineLength = getLineEnd(text, nextLineStart) - nextLineStart;
  const targetIndex =
    nextLineLength > 0
      ? nextLineStart + Math.min(targetColumn, nextLineLength - 1)
      : nextLineStart;

  return { column: targetColumn, index: targetIndex };
}

function getCharClass(character: string | undefined): "space" | "symbol" | "word" {
  if (!character || /\s/.test(character)) {
    return "space";
  }

  if (/\w/.test(character)) {
    return "word";
  }

  return "symbol";
}

function moveToNextWordStart(text: string, index: number): number {
  if (text.length === 0) {
    return 0;
  }

  let cursor = normalizeNormalCursor(text, index);
  const kind = getCharClass(text[cursor]);

  if (kind === "space") {
    while (cursor < text.length && getCharClass(text[cursor]) === "space") {
      cursor += 1;
    }
    return normalizeNormalCursor(text, cursor);
  }

  while (cursor < text.length && getCharClass(text[cursor]) === kind) {
    cursor += 1;
  }

  while (cursor < text.length && getCharClass(text[cursor]) === "space") {
    cursor += 1;
  }

  return normalizeNormalCursor(text, cursor);
}

function moveToPreviousWordStart(text: string, index: number): number {
  if (text.length === 0) {
    return 0;
  }

  let cursor = normalizeNormalCursor(text, Math.max(index - 1, 0));

  while (cursor > 0 && getCharClass(text[cursor]) === "space") {
    cursor -= 1;
  }

  const kind = getCharClass(text[cursor]);
  while (cursor > 0 && getCharClass(text[cursor - 1]) === kind) {
    cursor -= 1;
  }

  return cursor;
}

function moveToWordEnd(text: string, index: number): number {
  if (text.length === 0) {
    return 0;
  }

  let cursor = normalizeNormalCursor(text, index);

  while (cursor < text.length - 1 && getCharClass(text[cursor]) === "space") {
    cursor += 1;
  }

  const kind = getCharClass(text[cursor]);
  while (cursor < text.length - 1 && getCharClass(text[cursor + 1]) === kind) {
    cursor += 1;
  }

  return cursor;
}

// byte offset where a 1-based line begins, for moving the textarea caret
function lineStartOffset(text: string, line: number): number {
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

export interface SelectionRect {
  // pixels from the top of the textarea's content (caret coords, scroll-agnostic)
  top: number;
  height: number;
}

// vertical breathing room (px) added above/below the editor's gray streak
const STREAK_PAD = 3;

// Build a hidden div that wraps text exactly like the textarea, then read the
// pixel top of the line containing `position`. Putting the *remaining* text in
// the measured span keeps the line breaks after `position` identical to the
// textarea. (The classic textarea-caret-position technique.)
function measureCaretTop(
  textarea: HTMLTextAreaElement,
  computed: CSSStyleDeclaration,
  position: number
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
  end: number
): SelectionRect | null {
  const computed = window.getComputedStyle(textarea);
  const lineHeight = parseFloat(computed.lineHeight) || 24;
  const top = measureCaretTop(textarea, computed, start);
  const endTop = end > start ? measureCaretTop(textarea, computed, end) : top;
  return { top, height: Math.max(lineHeight, endTop + lineHeight - top) };
}

export function OperatorArticleEditor({
  articlePath,
  initialAssets,
  initialRaw,
  initialSha,
  previewBaseUrl,
}: {
  articlePath: string[];
  initialAssets: OperatorImageAsset[];
  initialRaw: string;
  initialSha?: string;
  previewBaseUrl: string;
}) {
  const [state, formAction, pending] = useActionState<OperatorFormState, FormData>(
    saveArticleAction,
    initialSha ? { sha: initialSha } : null
  );
  const [assets, setAssets] = useState(initialAssets);
  const [assetError, setAssetError] = useState("");
  const [assetToDelete, setAssetToDelete] = useState<OperatorImageAsset | null>(null);
  const [deletingAsset, setDeletingAsset] = useState<string | null>(null);
  const [activeDrawingWindowId, setActiveDrawingWindowId] = useState<number | null>(null);
  const [drawingWindows, setDrawingWindows] = useState<DrawingWindowState[]>([]);
  const [mode, setMode] = useState<EditorMode>("split");
  const [uploadingFile, setUploadingFile] = useState(false);
  // Normalize CRLF from the source file to LF up front so the textarea, preview
  // sync, and save payload all share one line-ending convention (GitHub can
  // serve \r\n). Keeps line-offset math consistent across the whole session.
  const [raw, setRaw] = useState(() => initialRaw.replace(/\r\n/g, "\n"));
  const [savingDrawingWindowId, setSavingDrawingWindowId] = useState<number | null>(
    null
  );
  const [pendingVimCommand, setPendingVimCommand] = useState<"d" | "g" | null>(
    null
  );
  const [vimEnabled, setVimEnabled] = useState(getStoredVimEnabled);
  const [vimMode, setVimMode] = useState<VimMode>(() =>
    getStoredVimEnabled() ? "normal" : "insert"
  );
  const formRef = useRef<HTMLFormElement>(null);
  const preferredColumnRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewApiRef = useRef<SyncedPreviewHandle>(null);
  // Live non-empty selection that the floating "-> preview" button acts on.
  // Sync is deliberate (button click / preview click), not automatic on cursor
  // moves. char offsets into `raw`.
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(
    null
  );
  // The synced range shown as a persistent gray streak in the editor (set when a
  // sync fires, in either direction). char offsets into `raw`.
  const [syncedRange, setSyncedRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  // Pixel rects (content coords) measured from the textarea via the mirror div;
  // recomputed when the range or text changes, not on every scroll frame.
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [syncedRect, setSyncedRect] = useState<SelectionRect | null>(null);
  const [measureNonce, setMeasureNonce] = useState(0);
  // Overlay layer (streak + button) is translated to follow the textarea's
  // internal scroll. Done imperatively via a ref so it tracks scroll 1:1 with no
  // React-render lag (state-driven positioning made the streak chase the text).
  const overlayLayerRef = useRef<HTMLDivElement>(null);
  const editorScrollTopRef = useRef(0);
  // The editor body (sidebar + textarea + preview) is sized to fill exactly the
  // space below everything above it -- the fixed navbar, the operator header, and
  // this editor's own title/toolbar. Measuring that offset (rather than assuming
  // only the 80px navbar) keeps the panes inside the viewport, so the textarea's
  // last line is always reachable by its own scroll instead of falling below the
  // fold and needing the page to scroll.
  const bodyGridRef = useRef<HTMLDivElement>(null);
  const headerSectionRef = useRef<HTMLDivElement>(null);
  const [editorOffset, setEditorOffset] = useState<number | null>(null);

  function setOverlayScroll(scrollTop: number) {
    editorScrollTopRef.current = scrollTop;
    if (overlayLayerRef.current) {
      overlayLayerRef.current.style.transform = `translateY(${-scrollTop}px)`;
    }
  }
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";
  const articleName = articlePath[articlePath.length - 1] ?? "Untitled";
  const articleLabel = articlePath.join(" / ");
  const parsed = useMemo(
    () => parseArticleDraft(raw, articleName),
    [articleName, raw]
  );
  const currentSha = state?.sha ?? initialSha ?? "";
  const previewHref = `/desk/${articlePath.join("/")}`;
  const publicHref = routeForPath(articlePath);

  // Preview line numbers are relative to the parsed body, the editor's are
  // relative to the full draft. This is the count of raw lines (title +
  // metadata + blanks) before the body starts, used to convert between them.
  // parseArticleDraft re-joins lines with "\n", so on CRLF input parsed.content
  // never matches raw verbatim; normalize to LF first so the match succeeds for
  // Windows line endings.
  const bodyOffset = useMemo(
    () => bodyLineOffset(raw.replace(/\r\n/g, "\n"), parsed.content),
    [raw, parsed.content]
  );

  // Track the live non-empty selection so the floating button can sit on it.
  // Collapsed caret => no button (nothing to deliberately sync).
  function updateSelection() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd } = textarea;
    if (selectionStart === selectionEnd) {
      setSelection(null);
      return;
    }
    setSelection({ start: selectionStart, end: selectionEnd });
  }

  // Measure the button/streak pixel rects whenever the range or text changes.
  // measureNonce lets a resize force a re-measure (wrapping depends on width).
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !selection) {
      setSelectionRect(null);
      return;
    }
    setSelectionRect(
      measureSelectionRect(textarea, selection.start, selection.end)
    );
  }, [selection, raw, measureNonce]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !syncedRange) {
      setSyncedRect(null);
      return;
    }
    setSyncedRect(
      measureSelectionRect(textarea, syncedRange.start, syncedRange.end)
    );
  }, [syncedRange, raw, measureNonce]);

  useEffect(() => {
    function onResize() {
      setMeasureNonce((n) => n + 1);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Measure how far the editor body sits below the top of the page so the panes
  // can be sized to fill the rest of the viewport exactly (see editorOffset). The
  // offset changes when the toolbar header grows/shrinks (vim help, save messages)
  // or the window resizes, so watch both.
  useLayoutEffect(() => {
    const grid = bodyGridRef.current;
    if (!grid) return;
    function measure() {
      const node = bodyGridRef.current;
      if (!node) return;
      // document-space top (scroll-independent): everything above the body
      const top = node.getBoundingClientRect().top + window.scrollY;
      setEditorOffset(Math.round(top));
    }
    measure();
    const observer = new ResizeObserver(measure);
    if (headerSectionRef.current) observer.observe(headerSectionRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Switching modes changes the editor pane's width (full in edit, half in
  // split), which re-wraps the text, so the cached rects are stale. It can also
  // remount the textarea (it unmounts in preview mode), leaving editorScrollTopRef
  // holding a scroll value the fresh element no longer has. Re-sync the overlay
  // from the live scrollTop and force a re-measure for the new width.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    setOverlayScroll(textarea ? textarea.scrollTop : 0);
    setMeasureNonce((n) => n + 1);
  }, [mode]);

  // editor -> preview: scroll the matching preview block to the same viewport
  // height as the selection, and leave a gray streak over the selected text. The
  // editor itself does not move (the user is looking at it).
  function syncToPreview() {
    const textarea = textareaRef.current;
    if (!textarea || !selection) return;
    const rect =
      selectionRect ??
      measureSelectionRect(textarea, selection.start, selection.end);
    if (!rect) return;
    const screenY =
      textarea.getBoundingClientRect().top + rect.top - textarea.scrollTop;
    const rawLine = raw.slice(0, selection.start).split("\n").length;
    const contentLine = rawLine - bodyOffset;
    if (contentLine >= 1) {
      previewApiRef.current?.alignLineToScreenY(contentLine, screenY);
    }
    setSyncedRange({ start: selection.start, end: selection.end });
    // swap the native selection for our gray streak; keep focus + caret
    textarea.setSelectionRange(selection.start, selection.start);
    setSelection(null);
  }

  // preview -> editor: scroll the editor so the matching text lands level with
  // the clicked preview block, and lay a gray streak over the block's lines.
  // useCallback so SyncedPreview (memoized) doesn't re-render on every unrelated
  // editor state change -- a preview re-render reflows it and can drop a click.
  const handlePreviewSelectBlock = useCallback(
    function handlePreviewSelectBlock({
      startLine,
      endLine,
      screenY,
      screenHeight,
    }: PreviewBlockSelection) {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const rawStart = startLine + bodyOffset;
      const startOffset = lineStartOffset(raw, rawStart);
      // endLine is the *next* block's start line; the clicked block's last line is
      // one above it. Trim trailing blank lines so the streak covers only this
      // block's text, not the blank separator or the next block's ```fence/heading.
      const lines = raw.split("\n");
      let lastLine = endLine == null ? lines.length : endLine + bodyOffset - 1;
      while (lastLine > rawStart && (lines[lastLine - 1] ?? "").trim() === "") {
        lastLine -= 1;
      }
      // sit endOffset on the last text line (before its newline) so the streak
      // bottom lands on that line's last visual row, not the line below it
      let endOffset = lineStartOffset(raw, lastLine + 1);
      if (endOffset > startOffset && raw[endOffset - 1] === "\n") endOffset -= 1;
      setSyncedRange({ start: startOffset, end: Math.max(startOffset, endOffset) });
      // measure the whole block (start..end) so we can keep its last line in view
      const rect = measureSelectionRect(textarea, startOffset, endOffset);
      if (rect) {
        const taTop = textarea.getBoundingClientRect().top;
        // preferred: line the block's CENTER up with the clicked preview block's
        // center (not just the top edges). The editor's mono text is denser than
        // the preview's prose, so equal blocks have different heights; centering
        // keeps the two highlights visually level. (rect.height - screenHeight)/2
        // nudges the top-aligned position by half the height difference.
        const aligned =
          rect.top - (screenY - taTop) + (rect.height - screenHeight) / 2;
        // but if that alignment would push the block's last line below the editor,
        // pull the block up so its bottom rests at the editor's bottom -- this is
        // the "click the code block and see the whole thing, closing fence
        // included" case. The editor now fits the viewport, so clientHeight is the
        // true visible height. Capped so the first line never scrolls past the top.
        const endAtBottom = rect.top + rect.height - textarea.clientHeight;
        const target = Math.min(Math.max(aligned, endAtBottom), rect.top);
        textarea.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
      }
    },
    [raw, bodyOffset]
  );

  useEffect(() => {
    function handleDocumentPointerDown(event: PointerEvent) {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('[data-drawing-window="true"]')
      ) {
        return;
      }

      setActiveDrawingWindowId(null);
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
    };
  }, []);

  function openDrawingWindow() {
    setDrawingWindows((current) => {
      const id = getNextDrawingWindowId(current);
      const offset = current.length * 28;
      setActiveDrawingWindowId(id);

      return [
        ...current,
        {
          id,
          position: {
            x: 72 + offset,
            y: 120 + offset,
          },
        },
      ];
    });
  }

  function focusDrawingWindow(id: number) {
    setActiveDrawingWindowId(id);
    setDrawingWindows((current) => {
      const windowToFocus = current.find((item) => item.id === id);
      if (!windowToFocus) {
        return current;
      }

      return [
        ...current.filter((item) => item.id !== id),
        windowToFocus,
      ];
    });
  }

  function closeDrawingWindow(id: number) {
    setDrawingWindows((current) => current.filter((item) => item.id !== id));
    setActiveDrawingWindowId((current) => (current === id ? null : current));
    setSavingDrawingWindowId((current) => (current === id ? null : current));
  }

  function setEditorSelection(index: number) {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.focus();
    textarea.setSelectionRange(index, index);
  }

  function applyEditorState(nextRaw: string, nextIndex: number, nextMode?: VimMode) {
    setRaw(nextRaw);
    if (nextMode) {
      setVimMode(nextMode);
    }

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }

      textarea.focus();
      textarea.setSelectionRange(nextIndex, nextIndex);
    });
  }

  function insertTextAtCursor(text: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setRaw((current) => `${current}${text}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextRaw = raw.slice(0, start) + text + raw.slice(end);
    const nextCursor = start + text.length;
    applyEditorState(nextRaw, nextCursor);
  }

  function handleAssetCreated(asset: OperatorImageAsset) {
    setAssets((current) => [asset, ...current]);
  }

  function insertAssetReference(asset: OperatorImageAsset) {
    insertTextAtCursor(`\n![${asset.displayName}](${asset.markdownPath})\n`);
  }

  function handleTextareaDrop(event: React.DragEvent<HTMLTextAreaElement>) {
    const files = event.dataTransfer.files;
    if (files.length === 0) return;
    event.preventDefault();

    setUploadingFile(true);
    setAssetError("");

    startTransition(async () => {
      try {
        const imageFiles = Array.from(files).filter((file) =>
          file.type.startsWith("image/")
        );
        if (imageFiles.length === 0) {
          setAssetError(
            "Only image files can be dropped here (png, jpeg, gif, webp, svg)."
          );
          return;
        }
        for (const file of imageFiles) {
          const form = new FormData();
          form.append("file", file);
          form.append("articlePath", articlePath.join("/"));
          const response = await fetch("/api/desk/upload", {
            method: "POST",
            body: form,
          });
          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as
              | { error?: string }
              | null;
            throw new Error(
              body?.error || `Upload failed (status ${response.status}).`
            );
          }
          const asset = (await response.json()) as OperatorImageAsset;
          handleAssetCreated(asset);
          insertTextAtCursor(`\n![${asset.displayName}](${asset.markdownPath})\n`);
        }
      } catch (error) {
        setAssetError(
          error instanceof Error ? error.message : "Upload failed."
        );
      } finally {
        setUploadingFile(false);
      }
    });
  }

  function confirmAssetDelete() {
    if (!assetToDelete) {
      return;
    }

    setAssetError("");
    setDeletingAsset(assetToDelete.filename);

    startTransition(async () => {
      try {
        await deleteImageAction({
          articlePath,
          darkFilename: assetToDelete.darkFilename,
          darkSha: assetToDelete.darkSha,
          filename: assetToDelete.filename,
          sha: assetToDelete.sha,
        });
        setAssets((current) =>
          current.filter((item) => item.filename !== assetToDelete.filename)
        );
        setAssetToDelete(null);
      } catch (error) {
        setAssetError(
          error instanceof Error ? error.message : "Unable to delete image."
        );
      } finally {
        setDeletingAsset(null);
      }
    });
  }

  function insertSnippet(before: string, after = "", placeholder = "") {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = raw.slice(start, end) || placeholder;
    const nextValue =
      raw.slice(0, start) + before + selected + after + raw.slice(end);

    setRaw(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursorStart = start + before.length;
      const cursorEnd = cursorStart + selected.length;
      textarea.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  function enterNormalMode(fromIndex: number) {
    preferredColumnRef.current = null;
    setPendingVimCommand(null);
    setVimMode("normal");
    setEditorSelection(normalizeNormalCursor(raw, fromIndex));
  }

  function enterInsertMode(index: number) {
    preferredColumnRef.current = null;
    setPendingVimCommand(null);
    setVimMode("insert");
    setEditorSelection(clamp(index, 0, raw.length));
  }

  function syncNormalCursorPosition() {
    if (!vimEnabled || vimMode !== "normal") {
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    requestAnimationFrame(() => {
      const current = textareaRef.current;
      if (!current) {
        return;
      }

      const nextIndex = normalizeNormalCursor(raw, current.selectionStart);
      current.setSelectionRange(nextIndex, nextIndex);
    });
  }

  function toggleVimMode() {
    const nextEnabled = !vimEnabled;
    setVimEnabled(nextEnabled);
    setPendingVimCommand(null);
    preferredColumnRef.current = null;

    const textarea = textareaRef.current;
    if (!textarea) {
      setVimMode(nextEnabled ? "normal" : "insert");
      return;
    }

    if (nextEnabled) {
      setVimMode("normal");
      const nextIndex = normalizeNormalCursor(raw, textarea.selectionStart);
      requestAnimationFrame(() => {
        const current = textareaRef.current;
        if (!current) {
          return;
        }
        current.focus();
        current.setSelectionRange(nextIndex, nextIndex);
      });
      return;
    }

    setVimMode("insert");
  }

  function handleNormalModeKey(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const textarea = event.currentTarget;
    const cursor = normalizeNormalCursor(raw, textarea.selectionStart);

    if (event.key !== "j" && event.key !== "k") {
      preferredColumnRef.current = null;
    }

    if (pendingVimCommand === "g") {
      setPendingVimCommand(null);
      if (event.key === "g") {
        setEditorSelection(0);
        return;
      }
    }

    if (pendingVimCommand === "d") {
      setPendingVimCommand(null);
      if (event.key === "d") {
        const start = getLineStart(raw, cursor);
        const end = getLineEnd(raw, cursor);
        const deleteEnd = end < raw.length ? end + 1 : end;
        const nextRaw = raw.slice(0, start) + raw.slice(deleteEnd);
        const nextIndex = normalizeNormalCursor(nextRaw, start);
        applyEditorState(nextRaw, nextRaw.length === 0 ? 0 : nextIndex);
        return;
      }
    }

    switch (event.key) {
      case "Escape":
        setPendingVimCommand(null);
        return;
      case "h":
        setEditorSelection(Math.max(cursor - 1, 0));
        return;
      case "l":
        setEditorSelection(
          raw.length === 0 ? 0 : Math.min(cursor + 1, raw.length - 1)
        );
        return;
      case "j": {
        const next = moveVertical(raw, cursor, 1, preferredColumnRef.current);
        preferredColumnRef.current = next.column;
        setEditorSelection(next.index);
        return;
      }
      case "k": {
        const next = moveVertical(raw, cursor, -1, preferredColumnRef.current);
        preferredColumnRef.current = next.column;
        setEditorSelection(next.index);
        return;
      }
      case "w":
        setEditorSelection(moveToNextWordStart(raw, cursor + 1));
        return;
      case "b":
        setEditorSelection(moveToPreviousWordStart(raw, cursor));
        return;
      case "e":
        setEditorSelection(moveToWordEnd(raw, cursor));
        return;
      case "0":
        setEditorSelection(getLineStart(raw, cursor));
        return;
      case "$":
        setEditorSelection(getLineLastCharacter(raw, cursor));
        return;
      case "g":
        setPendingVimCommand("g");
        return;
      case "G":
        setEditorSelection(normalizeNormalCursor(raw, raw.length - 1));
        return;
      case "i":
        enterInsertMode(cursor);
        return;
      case "a":
        enterInsertMode(raw.length === 0 ? 0 : Math.min(cursor + 1, raw.length));
        return;
      case "I":
        enterInsertMode(getFirstNonWhitespace(raw, cursor));
        return;
      case "A":
        enterInsertMode(getLineEnd(raw, cursor));
        return;
      case "o": {
        const lineEnd = getLineEnd(raw, cursor);
        const insertAt = lineEnd < raw.length ? lineEnd + 1 : lineEnd;
        const nextRaw = `${raw.slice(0, insertAt)}\n${raw.slice(insertAt)}`;
        applyEditorState(nextRaw, insertAt + 1, "insert");
        return;
      }
      case "O": {
        const lineStart = getLineStart(raw, cursor);
        const nextRaw = `${raw.slice(0, lineStart)}\n${raw.slice(lineStart)}`;
        applyEditorState(nextRaw, lineStart, "insert");
        return;
      }
      case "x": {
        if (raw.length === 0) {
          return;
        }

        const nextRaw = raw.slice(0, cursor) + raw.slice(cursor + 1);
        const nextIndex = normalizeNormalCursor(nextRaw, cursor);
        applyEditorState(nextRaw, nextRaw.length === 0 ? 0 : nextIndex);
        return;
      }
      case "d":
        setPendingVimCommand("d");
        return;
      default:
        setPendingVimCommand(null);
    }
  }

  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!vimEnabled) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (vimMode === "insert") {
      if (event.key === "Escape") {
        event.preventDefault();
        enterNormalMode(event.currentTarget.selectionStart - 1);
      }
      return;
    }

    event.preventDefault();
    handleNormalModeKey(event);
  }

  const submitOnShortcut = useCallback((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", submitOnShortcut);
    return () => {
      window.removeEventListener("keydown", submitOnShortcut);
    };
  }, [submitOnShortcut]);

  useEffect(() => {
    window.localStorage.setItem(VIM_STORAGE_KEY, vimEnabled ? "1" : "0");
  }, [vimEnabled]);

  return (
    <div
      className="border border-white/10 bg-white/[0.02]"
      // panes below read this for their height/sticky-top; falls back to the
      // navbar offset until the body's real top is measured on the client
      style={
        editorOffset != null
          ? ({ "--editor-offset": `${editorOffset}px` } as React.CSSProperties)
          : undefined
      }
    >
      <form ref={formRef} action={formAction}>
        <input type="hidden" name="articlePath" value={articlePath.join("/")} />
        <input type="hidden" name="sha" value={currentSha} />

        <div ref={headerSectionRef} className="border-b border-white/10 px-4 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {parsed.title || articleName}
              </h1>
              <p className="mt-1 text-xs text-white/50">{articleLabel}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openDrawingWindow}
                className="border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 transition-colors"
              >
                new drawing
              </button>
              <button
                type="button"
                onClick={toggleVimMode}
                className={`border px-3 py-1.5 text-sm transition-colors ${
                  vimEnabled
                    ? "border-white bg-white text-black"
                    : "border-white/20 hover:bg-white/10"
                }`}
              >
                vim {vimEnabled ? "on" : "off"}
              </button>
              <div className="flex border border-white/20">
                {(["edit", "preview", "split"] as EditorMode[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMode(option)}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      mode === option
                        ? "bg-white text-black"
                        : "hover:bg-white/10"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <Link
                href={previewHref}
                className="border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 transition-colors"
              >
                preview
              </Link>
              <Link
                href={publicHref}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 transition-colors"
              >
                public page
              </Link>
              <button
                type="submit"
                disabled={pending}
                className="bg-white text-black px-4 py-1.5 text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-60"
              >
                {pending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {TOOLBAR_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() =>
                  insertSnippet(
                    action.before,
                    action.after,
                    action.placeholder ?? ""
                  )
                }
                className="border border-white/20 px-3 py-1 text-xs text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                {action.label.toLowerCase()}
              </button>
            ))}
            <span className="ml-auto text-xs text-white/60">
              {vimEnabled
                ? `vim \u00b7 ${vimMode}${pendingVimCommand ? ` \u00b7 ${pendingVimCommand}` : ""}`
                : "save: cmd/ctrl+s"}
            </span>
          </div>

          {vimEnabled ? (
            <p className="mt-3 text-xs leading-5 text-white/50">
              Normal mode supports `hjkl`, `w`, `b`, `e`, `0`, `$`, `gg`, `G`,
              `i`, `a`, `I`, `A`, `o`, `O`, `x`, and `dd`. Press `Esc` to leave
              insert mode.
            </p>
          ) : null}

          {state?.error ? (
            <p className="mt-4 text-sm text-red-400">{state.error}</p>
          ) : null}
          {state?.message ? (
            <p className="mt-4 text-sm text-green-400">{state.message}</p>
          ) : null}
          {assetError && !assetToDelete ? (
            <p className="mt-4 text-sm text-red-400">{assetError}</p>
          ) : null}
        </div>

        <div
          ref={bodyGridRef}
          className="grid min-h-[70vh] gap-0 xl:min-h-0 xl:grid-cols-[18rem_1fr] xl:items-start"
        >
          <aside className="border-b border-white/10 bg-white/[0.02] xl:border-b-0 xl:border-r xl:flex xl:flex-col xl:h-[calc(100vh-var(--editor-offset,var(--sticky-header-offset,80px)))]">
            <div className="border-b border-white/10 px-4 py-3 xl:shrink-0">
              <h3 className="font-semibold text-white">images</h3>
              <p className="mt-1 text-xs text-white/50 leading-5">
                drag into the editor or click insert. save to persist references.
              </p>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4 xl:max-h-none xl:flex-1 xl:min-h-0">
              {assets.length === 0 ? (
                <p className="text-sm text-white/60">
                  no images yet. use the drawing window or upload assets later.
                </p>
              ) : (
                assets.map((asset) => (
                  <div
                    key={asset.filename}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        "text/plain",
                        `![${asset.displayName}](${asset.markdownPath})`
                      );
                      event.dataTransfer.effectAllowed = "copy";
                    }}
                    className="border border-white/10 bg-black p-3"
                  >
                    <div className="relative mb-3 aspect-video w-full border border-white/10 bg-[#efede7]">
                      <Image
                        src={
                          theme === "dark" && asset.darkUrl
                            ? asset.darkUrl
                            : asset.url
                        }
                        alt={asset.displayName}
                        fill
                        sizes="288px"
                        className="object-contain"
                      />
                    </div>
                    <p className="truncate text-sm font-medium text-white">
                      {asset.displayName}
                    </p>
                    <p className="mt-1 truncate font-mono text-xs text-white/40">
                      {theme === "dark" && asset.themeManaged
                        ? getThemeImageVariant(asset.markdownPath, "dark")
                        : asset.markdownPath}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => insertAssetReference(asset)}
                        className="flex-1 border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        insert
                      </button>
                      <button
                        type="button"
                        disabled={deletingAsset === asset.filename}
                        onClick={() => {
                          setAssetError("");
                          setAssetToDelete(asset);
                        }}
                        className="border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:text-white hover:bg-white/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingAsset === asset.filename ? "deleting..." : "delete"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>

          <div
            className={`grid min-h-[70vh] gap-0 xl:min-h-0 xl:items-start ${mode === "split" ? "xl:grid-cols-2" : "xl:grid-cols-1"}`}
          >
            {mode !== "preview" ? (
              <div
                className={`relative min-h-0 overflow-hidden ${mode === "split" ? "border-r border-white/10" : ""}`}
              >
                {/* Sticky wrapper holds BOTH the overlay and the textarea so they
                    stick together. The textarea used to be sticky on its own while
                    the overlay was absolute to the pane, so when the page scrolled
                    the sticky textarea slid away from the pane and the streak (in
                    the overlay) ended up offset by that displacement. Keeping both
                    in one sticky box means the streak's only transform is the
                    textarea's internal scroll. */}
                <div className="relative min-h-[70vh] xl:min-h-0 xl:h-[calc(100vh-var(--editor-offset,var(--sticky-header-offset,80px)))]">
                {/* Overlay layer: translated imperatively on scroll (see
                    setOverlayScroll) so the streak/button track the text 1:1.
                    Children are positioned in content coords. */}
                <div
                  ref={overlayLayerRef}
                  className="pointer-events-none absolute inset-0 z-10"
                  style={{ transform: `translateY(${-editorScrollTopRef.current}px)` }}
                >
                  {syncedRect != null ? (
                    <div
                      aria-hidden
                      className="absolute left-0 right-0 bg-white/10"
                      style={{
                        // pad equally above and below so the streak stays
                        // vertically centered on the synced text
                        top: syncedRect.top - STREAK_PAD,
                        height: syncedRect.height + STREAK_PAD * 2,
                      }}
                    />
                  ) : null}
                  {mode === "split" && selection != null && selectionRect != null ? (
                    <button
                      type="button"
                      // preventDefault keeps the textarea focused and its
                      // selection intact; otherwise clicking the button would
                      // blur the textarea (firing onBlur) and clear it first.
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={syncToPreview}
                      className="pointer-events-auto absolute right-2 flex items-center gap-1 border border-white/20 bg-black px-2 py-1 text-xs text-white/80 shadow-lg transition-colors hover:bg-white/10 hover:text-white"
                      style={{
                        top: selectionRect.top,
                        // sit just above the first selected line; flip below
                        // when the selection is too near the top to fit
                        transform:
                          selectionRect.top - editorScrollTopRef.current > 28
                            ? "translateY(calc(-100% - 4px))"
                            : "translateY(4px)",
                      }}
                    >
                      {"→ preview"}
                    </button>
                  ) : null}
                </div>
                <textarea
                  ref={textareaRef}
                  name="raw"
                  value={raw}
                  onChange={(event) => setRaw(event.target.value)}
                  onFocus={syncNormalCursorPosition}
                  onKeyDown={handleEditorKeyDown}
                  onMouseUp={() => {
                    syncNormalCursorPosition();
                    updateSelection();
                  }}
                  onSelect={updateSelection}
                  onBlur={() => setSelection(null)}
                  onScroll={(event) =>
                    setOverlayScroll(event.currentTarget.scrollTop)
                  }
                  onDragOver={(event) => {
                    if (event.dataTransfer.types.includes("Files")) {
                      event.preventDefault();
                    }
                  }}
                  onDrop={handleTextareaDrop}
                  spellCheck={false}
                  className={`block min-h-[70vh] w-full resize-none bg-black px-4 py-4 font-mono text-sm leading-6 text-white outline-none xl:min-h-0 xl:h-full ${uploadingFile ? "opacity-50" : ""}`}
                />
                </div>
              </div>
            ) : null}

            {mode !== "edit" ? (
              <SyncedPreview
                ref={previewApiRef}
                title={parsed.title || articleName}
                prerequisites={parsed.prerequisites}
                content={parsed.content}
                imageBaseUrl={previewBaseUrl}
                onSelectBlock={handlePreviewSelectBlock}
              />
            ) : null}
          </div>
        </div>
      </form>

      {drawingWindows.map((windowState, index) => (
        <OperatorDrawingWindow
          key={windowState.id}
          active={windowState.id === activeDrawingWindowId}
          articlePath={articlePath}
          disableSave={
            savingDrawingWindowId !== null && savingDrawingWindowId !== windowState.id
          }
          initialPosition={windowState.position}
          onAssetCreated={handleAssetCreated}
          onClose={() => closeDrawingWindow(windowState.id)}
          onFocus={() => focusDrawingWindow(windowState.id)}
          onSaveEnd={() => setSavingDrawingWindowId(null)}
          onSaveStart={() => setSavingDrawingWindowId(windowState.id)}
          windowId={windowState.id}
          zIndex={80 + index}
        />
      ))}

      {assetToDelete ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4">
          <div className="bg-black border border-white/20 p-6 max-w-sm w-full flex flex-col gap-4">
            <p className="text-sm text-white">
              Delete <span className="font-medium">{assetToDelete.displayName}</span>? Existing markdown references will break.
            </p>
            {assetError ? (
              <p className="text-sm text-red-400">{assetError}</p>
            ) : null}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setAssetError("");
                  setAssetToDelete(null);
                }}
                className="text-sm hover:bg-white/10 px-4 py-1.5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingAsset === assetToDelete.filename}
                onClick={confirmAssetDelete}
                className="bg-red-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-600"
              >
                {deletingAsset === assetToDelete.filename ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
