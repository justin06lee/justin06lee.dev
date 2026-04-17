"use client";

import Image from "next/image";
import Link from "next/link";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { parseArticleDraft } from "@/lib/article-draft";
import { routeForPath } from "@/lib/github";
import type { OperatorImageAsset } from "@/lib/operator-content";
import { getThemeImageVariant } from "@/lib/theme-images";
import { CollapsibleMarkdown } from "@/components/article/collapsible-markdown";
import { useTheme } from "next-themes";
import { OperatorDrawingWindow } from "./OperatorDrawingWindow";
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
  const [raw, setRaw] = useState(initialRaw);
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
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";
  const articleName = articlePath[articlePath.length - 1] ?? "Untitled";
  const articleLabel = articlePath.join(" / ");
  const parsed = useMemo(
    () => parseArticleDraft(raw, articleName),
    [articleName, raw]
  );
  const currentSha = state?.sha ?? initialSha ?? "";
  const previewHref = `/author/${articlePath.join("/")}`;
  const publicHref = routeForPath(articlePath);

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
          const response = await fetch("/api/operator/upload", {
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
    <div className="border border-border bg-surface">
      <form ref={formRef} action={formAction}>
        <input type="hidden" name="articlePath" value={articlePath.join("/")} />
        <input type="hidden" name="sha" value={currentSha} />

        <div className="border-b border-border px-4 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Article Editor
              </p>
              <h1 className="mt-1 text-3xl tracking-tight text-foreground">
                {parsed.title || articleName}
              </h1>
              <p className="mt-2 text-sm text-muted">
                {articleLabel}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openDrawingWindow}
                className="border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-alt"
              >
                New drawing window
              </button>
              <button
                type="button"
                onClick={toggleVimMode}
                className={`border px-3 py-2 text-sm transition-colors ${
                  vimEnabled
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-surface text-foreground hover:bg-surface-alt"
                }`}
              >
                Vim {vimEnabled ? "on" : "off"}
              </button>
              <div className="flex border border-border">
                {(["edit", "preview", "split"] as EditorMode[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMode(option)}
                    className={`px-3 py-2 text-sm transition-colors ${
                      mode === option
                        ? "bg-foreground text-background"
                        : "bg-surface text-foreground hover:bg-surface-alt"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <Link
                href={previewHref}
                className="border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-alt"
              >
                View operator page
              </Link>
              <Link
                href={publicHref}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-alt"
              >
                Open public page
              </Link>
              <button
                type="submit"
                disabled={pending}
                className="border border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Saving..." : "Save article"}
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
                className="border border-border px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-foreground transition-colors hover:bg-surface-alt"
              >
                {action.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted">
              {vimEnabled
                ? `Vim ${vimMode}${pendingVimCommand ? ` \u00b7 ${pendingVimCommand}` : ""}`
                : "Cmd/Ctrl + S to save"}
            </span>
          </div>

          {vimEnabled ? (
            <p className="mt-3 text-xs leading-5 text-muted">
              Normal mode supports `hjkl`, `w`, `b`, `e`, `0`, `$`, `gg`, `G`,
              `i`, `a`, `I`, `A`, `o`, `O`, `x`, and `dd`. Press `Esc` to leave
              insert mode.
            </p>
          ) : null}

          {state?.error ? (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          ) : null}
          {state?.message ? (
            <p className="mt-4 text-sm text-foreground">{state.message}</p>
          ) : null}
          {assetError && !assetToDelete ? (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">
              {assetError}
            </p>
          ) : null}
        </div>

        <div className="grid min-h-[70vh] gap-0 xl:grid-cols-[18rem_1fr]">
          <aside className="border-b border-border bg-surface-alt xl:border-b-0 xl:border-r">
            <div className="border-b border-border px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Images
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Drag into the editor or click insert. Save the article to persist
                image references.
              </p>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
              {assets.length === 0 ? (
                <p className="text-sm text-muted">
                  No images yet. Use the drawing window or upload assets later.
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
                    className="border border-border bg-surface p-3"
                  >
                    <div className="relative mb-3 aspect-video w-full border border-border bg-[#efede7]">
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
                    <p className="truncate text-sm font-medium text-foreground">
                      {asset.displayName}
                    </p>
                    <p className="mt-1 truncate font-mono text-xs text-muted">
                      {theme === "dark" && asset.themeManaged
                        ? getThemeImageVariant(asset.markdownPath, "dark")
                        : asset.markdownPath}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => insertAssetReference(asset)}
                        className="flex-1 border border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-foreground transition-colors hover:bg-surface-alt"
                      >
                        Insert
                      </button>
                      <button
                        type="button"
                        disabled={deletingAsset === asset.filename}
                        onClick={() => {
                          setAssetError("");
                          setAssetToDelete(asset);
                        }}
                        className="border border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-foreground transition-colors hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingAsset === asset.filename ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>

          <div className="grid min-h-[70vh] gap-0 xl:h-[70vh] xl:grid-cols-2">
            {mode !== "preview" ? (
              <div
                className={`min-h-0 ${mode === "split" ? "border-r border-border" : ""}`}
              >
                <textarea
                  ref={textareaRef}
                  name="raw"
                  value={raw}
                  onChange={(event) => setRaw(event.target.value)}
                  onFocus={syncNormalCursorPosition}
                  onKeyDown={handleEditorKeyDown}
                  onMouseUp={syncNormalCursorPosition}
                  onDragOver={(event) => {
                    if (event.dataTransfer.types.includes("Files")) {
                      event.preventDefault();
                    }
                  }}
                  onDrop={handleTextareaDrop}
                  spellCheck={false}
                  className={`h-full min-h-[70vh] w-full resize-none bg-background px-4 py-4 font-mono text-sm leading-6 text-foreground outline-none ${uploadingFile ? "opacity-50" : ""}`}
                />
              </div>
            ) : null}

            {mode !== "edit" ? (
              <div className="min-h-0 bg-background xl:overflow-y-auto">
                <div className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
                  Live preview
                </div>
                <div className="px-4 py-6 lg:px-8">
                  <h1 className="mb-3 text-5xl font-normal leading-tight tracking-tight text-foreground">
                    {parsed.title || articleName}
                  </h1>
                  {parsed.prerequisites.length > 0 ? (
                    <p className="mb-8 text-sm leading-6 text-muted">
                      Prerequisites: {parsed.prerequisites.join(", ")}
                    </p>
                  ) : null}
                  <CollapsibleMarkdown
                    content={parsed.content}
                    imageBaseUrl={previewBaseUrl}
                  />
                </div>
              </div>
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/25 px-4">
          <div className="w-full max-w-md border border-border bg-surface p-6 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Delete Image
            </p>
            <h2 className="mt-2 text-2xl tracking-tight text-foreground">
              {assetToDelete.displayName}
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted">
              This removes the image from GitHub. Any existing markdown references
              to it will stop working.
            </p>
            {assetError ? (
              <p className="mt-4 text-sm leading-6 text-red-600 dark:text-red-400">
                {assetError}
              </p>
            ) : null}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setAssetError("");
                  setAssetToDelete(null);
                }}
                className="border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-alt"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingAsset === assetToDelete.filename}
                onClick={confirmAssetDelete}
                className="border border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingAsset === assetToDelete.filename ? "Deleting..." : "Delete image"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
