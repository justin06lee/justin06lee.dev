"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EditorPreview } from "@/components/chrome/editor-preview";
import { useLineSync, STREAK_PAD, type UseLineSyncReturn } from "@/hooks/use-line-sync";

/**
 * Size presets — each sets height AND width (width clamped to the container).
 * `screen` matches justin06lee.dev/desk: full container width, viewport height
 * minus a header allowance. `auto` opts out so `className` owns the sizing.
 * Any preset can still be overridden by `h-*` / `w-*` classes in `className`.
 */
export type EditorSize = "sm" | "md" | "lg" | "xl" | "2xl" | "screen" | "auto";

export const EDITOR_SIZE_CLASS: Record<Exclude<EditorSize, "auto">, string> = {
  sm: "h-80 w-[32rem] max-w-full mx-auto",
  md: "h-[28rem] w-[44rem] max-w-full mx-auto",
  lg: "h-[36rem] w-[56rem] max-w-full mx-auto",
  xl: "h-[44rem] w-[72rem] max-w-full mx-auto",
  "2xl": "h-[52rem] w-[88rem] max-w-full mx-auto",
  screen: "h-[calc(100dvh-10rem)] min-h-[24rem] w-full",
};

export function editorSizeClass(size: EditorSize): string | undefined {
  return size === "auto" ? undefined : EDITOR_SIZE_CLASS[size];
}

export interface EditorTextareaProps {
  /** A `useLineSync(...)` return value, shared with the paired `<EditorPreview>`. */
  sync: UseLineSyncReturn;
  /** Markdown source (controlled). */
  value: string;
  /** Called with the next markdown source on edit. */
  onChange: (value: string) => void;
  placeholder?: string;
  /**
   * Passthrough `keydown` on the textarea. An escape hatch for layering your own
   * keymap (e.g. a vim mode) over the plain editor without forking it.
   */
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Sizing/extra classes (give it a height). */
  className?: string;
}

/**
 * The editor half on its own: a `<textarea>` with the gray-streak + "preview"
 * button overlay, driven by a `useLineSync` engine. Pair it with a `<EditorPreview>`
 * that shares the same engine and they stay in sync even in separate, non-adjacent
 * containers — the engine aligns by viewport coordinates, not relative layout.
 */
export function EditorTextarea({
  sync,
  value,
  onChange,
  placeholder,
  onKeyDown,
  className,
}: EditorTextareaProps) {
  const {
    textareaRef,
    overlayLayerRef,
    editorScrollTopRef,
    syncedRect,
    selection,
    selectionRect,
    syncToPreview,
    refreshSelection,
    clearSelection,
    handleScroll,
  } = sync;

  // On mount, sync the overlay to the fresh textarea's scroll position — after
  // a remount (e.g. a desk mode toggle) the shared ref still holds the old
  // textarea's scrollTop, which would offset the overlay until the next scroll.
  useLayoutEffect(() => {
    handleScroll(textareaRef.current?.scrollTop ?? 0);
  }, [handleScroll, textareaRef]);

  return (
    <div className={cn("relative min-h-0 overflow-hidden", className)}>
      <div className="relative h-full min-h-0">
        {/* overlay layer: translated on scroll so streak/button track text 1:1 */}
        <div
          ref={overlayLayerRef}
          className="pointer-events-none absolute inset-0 z-10"
          style={{ transform: `translateY(${-editorScrollTopRef.current}px)` }}
        >
          {syncedRect != null ? (
            <div
              aria-hidden
              className="absolute left-0 right-0 bg-white/10"
              style={{ top: syncedRect.top - STREAK_PAD, height: syncedRect.height + STREAK_PAD * 2 }}
            />
          ) : null}
          {selection != null && selectionRect != null ? (
            <button
              type="button"
              // preventDefault keeps the textarea focused + its selection intact
              onMouseDown={(event) => event.preventDefault()}
              onClick={syncToPreview}
              className="pointer-events-auto absolute right-2 flex items-center gap-1 border border-white/20 bg-black px-2 py-1 text-xs text-white/80 shadow-lg transition-colors hover:bg-white/10 hover:text-white"
              style={{
                top: selectionRect.top,
                transform:
                  selectionRect.top - editorScrollTopRef.current > 28
                    ? "translateY(calc(-100% - 4px))"
                    : "translateY(4px)",
              }}
            >
              <ArrowRight size={12} aria-hidden />
              preview
            </button>
          ) : null}
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onMouseUp={refreshSelection}
          onSelect={refreshSelection}
          onBlur={clearSelection}
          onKeyDown={onKeyDown}
          onScroll={(event) => handleScroll(event.currentTarget.scrollTop)}
          spellCheck={false}
          placeholder={placeholder}
          className="h-full w-full resize-none bg-black px-4 py-6 font-mono text-[13px] leading-6 text-white/90 outline-none placeholder:text-white/30 lg:px-8"
        />
      </div>
    </div>
  );
}

export interface EditorProps {
  /** Markdown source (controlled). */
  value: string;
  /** Called with the next markdown source on edit. */
  onChange: (value: string) => void;
  /**
   * Renders the markdown with line-sync enabled — typically
   * `(md, { highlightLine }) => <Prose lineSync highlightLine={highlightLine}>{md}</Prose>`.
   */
  renderMarkdown: (
    markdown: string,
    state: { highlightLine: number | null },
  ) => ReactNode;
  /** Sticky label over the preview pane. Defaults to "live preview". */
  label?: ReactNode;
  /** Editor textarea placeholder. */
  placeholder?: string;
  /** Size preset (height + width); defaults to the container-filling `screen`. */
  size?: EditorSize;
  /** Extra classes for the root; `h-*` / `w-*` classes here override `size`. */
  className?: string;
}

/**
 * Turnkey split-pane markdown editor: `EditorTextarea` beside a
 * `<EditorPreview>`, sharing one `useLineSync` engine so the preview scrolls and
 * highlights in sync both ways. Dark-only. Sized via the `size` preset
 * (viewport-filling by default, like justin06lee.dev/desk). For a custom
 * layout, drop down to `useLineSync` + the two pieces directly.
 */
export function Editor({
  value,
  onChange,
  renderMarkdown,
  label = "live preview",
  placeholder,
  size = "screen",
  className,
}: EditorProps) {
  const sync = useLineSync({ value });

  return (
    <div className={cn("flex min-h-0 flex-col md:flex-row", editorSizeClass(size), className)}>
      <EditorTextarea
        sync={sync}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="flex-1 border-b border-white/10 md:border-b-0 md:border-r"
      />
      <EditorPreview
        ref={sync.previewRef}
        content={value}
        renderMarkdown={renderMarkdown}
        onSelectBlock={sync.onPreviewSelectBlock}
        label={label}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
