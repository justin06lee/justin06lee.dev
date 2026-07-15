"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AssetSidebar, type Asset } from "@/components/chrome/asset-sidebar";
import { EditorTextarea, editorSizeClass, type EditorSize } from "@/components/chrome/editor";
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
  /** Files dropped on the sidebar's drop zone. Omit to hide the drop zone. */
  onUploadAssets?: (files: File[]) => void;
  /** Called on Save and on cmd/ctrl+s. */
  onSave?: (value: string) => void | Promise<void>;
  /** Called when a drawing window saves; the window then closes. */
  onSaveDrawing?: (result: DrawingSaveResult) => void | Promise<void>;
  /** Draw in light colors remapped to a dark variant in the drawing windows. */
  drawingDarkMapping?: boolean;
  /** Extra toolbar actions, inserted before the Save button. */
  actions?: ReactNode;
  /** Size preset (height + width); defaults to the container-filling `screen`. */
  size?: EditorSize;
  /** Extra classes for the root; `h-*` / `w-*` classes here override `size`. */
  className?: string;
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
  size = "screen",
  className,
}: DeskProps) {
  const sync = useLineSync({ value });
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
              className={cn(
                "min-h-[24rem] border-b border-white/10 xl:h-full xl:min-h-0 xl:border-b-0",
                mode === "split" ? "xl:border-r" : "",
              )}
            />
          ) : null}
          {mode !== "edit" ? (
            <EditorPreview
              ref={sync.previewRef}
              content={value}
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
