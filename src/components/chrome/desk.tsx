"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AssetSidebar, type Asset } from "@/components/chrome/asset-sidebar";
import {
  EditorTextarea,
  editorSizeClass,
  type EditorSize,
  type EditorTextareaElementProps,
} from "@/components/chrome/editor";
import { EditorPreview } from "@/components/chrome/editor-preview";
import {
  EditorToolbar,
  type EditorFormatAction,
} from "@/components/chrome/editor-toolbar";
import type { DrawingSaveResult } from "@/components/chrome/drawing-window";
import { useLineSync } from "@/hooks/use-line-sync";

type EditorMode = "edit" | "preview" | "split";

export interface DeskProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Markdown source (controlled). */
  value: string;
  onChange: (value: string) => void;
  /**
   * Renders the markdown for the preview with line-sync — typically
   * `(md, { highlightLine }) => <Prose lineSync highlightLine={highlightLine}>{md}</Prose>`.
   */
  renderMarkdown: (
    markdown: string,
    state: { highlightLine: number | null },
  ) => ReactNode;
  /** Images shown in the left sidebar. */
  assets?: Asset[];
  /** Notified when an asset's "insert" is clicked (the ref is also spliced in). */
  onInsertAsset?: (asset: Asset) => void;
  /** Forwarded from the sidebar's delete button — the parent owns any confirm. */
  onDeleteAsset?: (asset: Asset) => void;
  /**
   * Files dropped on the sidebar's drop zone OR directly onto the editor
   * textarea. Omit to hide the drop zone and disable textarea file drops.
   * Return the created assets (sync or async) and a textarea drop also splices
   * their markdown refs at the caret; a void return just uploads.
   */
  onUploadAssets?: (files: File[]) => void | Asset[] | Promise<Asset[] | void>;
  /** Called on Save and on cmd/ctrl+s. */
  onSave?: (value: string) => void | Promise<void>;
  /** Called when a drawing window saves; the window then closes. */
  onSaveDrawing?: (result: DrawingSaveResult) => void | Promise<void>;
  /** Draw in light colors remapped to a dark variant in the drawing windows. */
  drawingDarkMapping?: boolean;
  /** Extra toolbar actions, inserted before the Save button. */
  actions?: ReactNode;
  /**
   * Extra props for the underlying `<textarea>` (e.g. `onKeyDown` to layer a
   * vim keymap). Handlers compose with the internal ones — internal splice/
   * save/drop glue runs first, then yours with the same event; `className` is
   * merged. `value`/`onChange` stay owned by the desk.
   */
  textareaProps?: EditorTextareaElementProps;
  /**
   * Derive the preview's markdown from the editor value — e.g. strip a leading
   * front-matter region (`# title`, `cover:`, `tags:`, …) — and report how many
   * source lines were removed so the two-way line-sync stays aligned: editor
   * line N maps to preview block line N − `lineOffset`, and selections inside
   * the stripped region clamp to the first preview block. Keep the reference
   * stable (define it outside the render). Omit for 1:1 sync on the raw value.
   */
  transformSource?: (source: string) => { body: string; lineOffset: number };
  /** Size preset (height + width); defaults to the container-filling `screen`. */
  size?: EditorSize;
  /** Extra classes for the root; `h-*` / `w-*` classes here override `size`. */
  className?: string;
}

// True while the drag carries OS files (vs. e.g. a sidebar row's text/plain).
function isFileDrag(event: DragEvent<HTMLTextAreaElement>): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

/**
 * The full `/desk` markdown workbench: an `EditorToolbar` (mode toggle + format
 * buttons + "new drawing", which owns the floating numbered drawing windows), an
 * image sidebar, and a split text editor with a two-way synced preview. Composes
 * the `editor`, `asset-sidebar`, and `editor-toolbar` (which owns `drawing-window`)
 * components. Dark-only. Sized via the `size` preset (viewport-filling by
 * default, like justin06lee.dev/desk). Backend ops are callbacks.
 */
export function Desk({
  title,
  subtitle,
  value,
  onChange,
  renderMarkdown,
  assets = [],
  onInsertAsset,
  onDeleteAsset,
  onUploadAssets,
  onSave,
  onSaveDrawing,
  drawingDarkMapping,
  actions,
  textareaProps,
  transformSource,
  size = "screen",
  className,
}: DeskProps) {
  // When a transform strips a leading front-matter region, the preview renders
  // the body and the sync engine shifts line numbers by the reported offset.
  const transformed = useMemo(
    () => (transformSource ? transformSource(value) : null),
    [transformSource, value],
  );
  const sync = useLineSync({ value, bodyLineOffset: transformed?.lineOffset ?? 0 });
  const [mode, setMode] = useState<EditorMode>("split");

  // Splice text at the textarea caret, then restore focus + selection.
  function insertTextAtCursor(text: string) {
    const textarea = sync.textareaRef.current;
    if (!textarea) {
      onChange(`${value}${text}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    onChange(value.slice(0, start) + text + value.slice(end));
    const cursor = start + text.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  // Wrap the selection (or the placeholder) with a format action's before/after.
  function insertSnippet(action: EditorFormatAction) {
    const textarea = sync.textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || action.placeholder || "";
    const after = action.after ?? "";
    onChange(value.slice(0, start) + action.before + selected + after + value.slice(end));
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorStart = start + action.before.length;
      const cursorEnd = cursorStart + selected.length;
      textarea.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  function insertAssetReference(asset: Asset) {
    insertTextAtCursor(`\n![${asset.name}](${asset.markdownPath})\n`);
    onInsertAsset?.(asset);
  }

  // --- drop a file onto the textarea: upload + insert the markdown ref ------

  const [fileDragOver, setFileDragOver] = useState(false);
  const fileDragDepth = useRef(0);
  // Latest value/onChange for the async insert — the upload can resolve many
  // keystrokes after the drop, so the drop-time closure would be stale.
  const editRef = useRef({ value, onChange });
  editRef.current = { value, onChange };

  function resetFileDrag() {
    fileDragDepth.current = 0;
    setFileDragOver(false);
  }

  // Upload through the same handler the sidebar drop zone uses; if it returns
  // the created assets, splice their markdown refs at the drop-time caret.
  async function uploadDroppedFiles(files: File[], caret: number) {
    if (!onUploadAssets) return;
    const uploaded = await onUploadAssets(files);
    if (!uploaded || uploaded.length === 0) return;
    const { value: current, onChange: change } = editRef.current;
    const at = Math.min(caret, current.length);
    const text = uploaded
      .map((asset) => `\n![${asset.name}](${asset.markdownPath})\n`)
      .join("");
    change(current.slice(0, at) + text + current.slice(at));
    const cursor = at + text.length;
    requestAnimationFrame(() => {
      const textarea = sync.textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  // The host's textareaProps merged with the file-drop wiring. Internal
  // handlers run first, then the host's (same event). File drags are only
  // intercepted when there's an upload handler; plain text drags (a sidebar
  // row) keep the browser's native insert-at-drop-point behavior.
  const mergedTextareaProps: EditorTextareaElementProps = {
    ...textareaProps,
    className: cn(
      // drop-target affordance while files hover over the editor
      fileDragOver && "ring-1 ring-inset ring-white/40",
      textareaProps?.className,
    ),
    onDragEnter: (event) => {
      if (onUploadAssets && isFileDrag(event)) {
        fileDragDepth.current += 1;
        setFileDragOver(true);
      }
      textareaProps?.onDragEnter?.(event);
    },
    onDragOver: (event) => {
      if (onUploadAssets && isFileDrag(event)) {
        // preventDefault marks the textarea as a valid file-drop target
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }
      textareaProps?.onDragOver?.(event);
    },
    onDragLeave: (event) => {
      if (onUploadAssets && isFileDrag(event)) {
        fileDragDepth.current -= 1;
        if (fileDragDepth.current <= 0) resetFileDrag();
      }
      textareaProps?.onDragLeave?.(event);
    },
    onDrop: (event) => {
      if (onUploadAssets) {
        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) {
          event.preventDefault();
          resetFileDrag();
          void uploadDroppedFiles(files, event.currentTarget.selectionEnd);
        }
      }
      textareaProps?.onDrop?.(event);
    },
  };

  // cmd/ctrl+s saves. The latest value/onSave live in a ref so the window
  // listener binds once instead of re-binding on every keystroke.
  const saveRef = useRef({ value, onSave });
  saveRef.current = { value, onSave };
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        const { value: current, onSave: save } = saveRef.current;
        // Only hijack the browser shortcut when there's a save handler.
        if (!save) return;
        event.preventDefault();
        void save(current);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden border border-white/10 bg-white/[0.02]",
        editorSizeClass(size),
        className,
      )}
    >
      <EditorToolbar
        title={title}
        subtitle={subtitle}
        mode={mode}
        onModeChange={(next) => setMode(next as EditorMode)}
        onFormat={insertSnippet}
        status="save: cmd/ctrl+s"
        className="shrink-0"
        enableDrawing
        onSaveDrawing={onSaveDrawing}
        drawingDarkMapping={drawingDarkMapping}
        drawingSubtitle={typeof subtitle === "string" ? subtitle : undefined}
        actions={
          <>
            {actions}
            <button
              type="button"
              onClick={() => void onSave?.(value)}
              disabled={!onSave}
              className="bg-white px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              save
            </button>
          </>
        }
      />

      <div className="grid min-h-0 min-w-0 flex-1 xl:grid-cols-[18rem_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)]">
        <AssetSidebar
          assets={assets}
          onInsert={insertAssetReference}
          onDelete={onDeleteAsset}
          onUpload={onUploadAssets}
          description="drag into the editor or click insert."
          className="max-h-[20rem] border-x-0 border-t-0 xl:max-h-none xl:border-b-0 xl:border-r"
        />

        <div
          className={cn(
            "grid min-h-0 xl:grid-rows-[minmax(0,1fr)]",
            mode === "split" ? "xl:grid-cols-2" : "grid-cols-1",
          )}
        >
          {mode !== "preview" ? (
            <EditorTextarea
              sync={sync}
              value={value}
              onChange={onChange}
              textareaProps={mergedTextareaProps}
              className={cn(
                "min-h-[24rem] border-b border-white/10 xl:h-full xl:min-h-0 xl:border-b-0",
                mode === "split" ? "xl:border-r" : "",
              )}
            />
          ) : null}
          {mode !== "edit" ? (
            <EditorPreview
              ref={sync.previewRef}
              content={transformed?.body ?? value}
              renderMarkdown={renderMarkdown}
              onSelectBlock={sync.onPreviewSelectBlock}
              className="min-h-[24rem] xl:h-full xl:min-h-0"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
