"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  DrawingWindow,
  type DrawingSaveResult,
} from "@/components/chrome/drawing-window";

export interface EditorFormatAction {
  /** Button label (rendered lowercased). */
  label: string;
  /** Text inserted before the selection/placeholder. */
  before: string;
  /** Text inserted after the selection/placeholder. */
  after?: string;
  /** Used when there is no selection to wrap. */
  placeholder?: string;
}

/** Default markdown formatting actions: H2, Bold, List, Code, Link, Math. */
export const MARKDOWN_FORMAT_ACTIONS: EditorFormatAction[] = [
  { label: "H2", before: "\n## ", placeholder: "Section Title" },
  { label: "Bold", before: "**", after: "**", placeholder: "bold text" },
  { label: "List", before: "\n- ", placeholder: "List item" },
  { label: "Code", before: "\n```txt\n", after: "\n```\n", placeholder: "code" },
  { label: "Link", before: "[", after: "](https://example.com)", placeholder: "label" },
  { label: "Math", before: "\n$$\n", after: "\n$$\n", placeholder: "x^2 + y^2 = z^2" },
];

interface DrawingWindowState {
  id: number;
  position: { x: number; y: number };
}

/** Lowest free 1-based id, so closed windows free their number for reuse. */
function nextDrawingId(windows: DrawingWindowState[]): number {
  const ids = new Set(windows.map((w) => w.id));
  let id = 1;
  while (ids.has(id)) id += 1;
  return id;
}

export interface EditorToolbarProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Current view mode. Pass `onModeChange` too to render the segmented toggle. */
  mode?: string;
  onModeChange?: (mode: string) => void;
  /** Modes shown in the segmented toggle. */
  modes?: string[];
  /** Right-hand button cluster (Save, links…). Rendered after the toggle. */
  actions?: ReactNode;
  /** Markdown format buttons. Defaults to MARKDOWN_FORMAT_ACTIONS; pass `[]` to hide. */
  formatActions?: EditorFormatAction[];
  /** Fired when a format button is clicked. Omit to hide the format buttons. */
  onFormat?: (action: EditorFormatAction) => void;
  /** Right-aligned hint in the format row (e.g. "save: cmd/ctrl+s"). */
  status?: ReactNode;
  /**
   * Show a "new drawing" button that opens managed, numbered, draggable drawing
   * windows ("drawing #1", "#2", …) — multiple at once, brought to front on
   * focus, with a one-at-a-time save lock. The toolbar owns the window state.
   */
  enableDrawing?: boolean;
  /** Called when a drawing window saves; the window then closes. */
  onSaveDrawing?: (result: DrawingSaveResult) => void | Promise<void>;
  /** Subtitle shown under each drawing window's "drawing #N" title. */
  drawingSubtitle?: string;
  /** Use the drawing window's light-to-dark mapping mode. */
  drawingDarkMapping?: boolean;
  className?: string;
}

/**
 * The bar above a markdown editor. Two rows: a heading + action cluster (with an
 * optional edit/preview/split toggle and a "new drawing" button), and a row of
 * markdown format buttons. Presentational, except that — when `enableDrawing` is
 * set — it owns and renders the floating `DrawingWindow`s. Dark-only.
 */
export function EditorToolbar({
  title,
  subtitle,
  mode,
  onModeChange,
  modes = ["edit", "preview", "split"],
  actions,
  formatActions = MARKDOWN_FORMAT_ACTIONS,
  onFormat,
  status,
  enableDrawing = false,
  onSaveDrawing,
  drawingSubtitle,
  drawingDarkMapping,
  className,
}: EditorToolbarProps) {
  const showFormatRow = (formatActions.length > 0 && onFormat) || status != null;
  const hasActionCluster = enableDrawing || Boolean(onModeChange) || actions != null;

  // --- managed multi-window drawing state (only used when enableDrawing) ------
  const [drawingWindows, setDrawingWindows] = useState<DrawingWindowState[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  function openDrawing() {
    setDrawingWindows((current) => {
      const id = nextDrawingId(current);
      const offset = current.length * 28; // cascade each new window
      setActiveId(id);
      return [...current, { id, position: { x: 72 + offset, y: 120 + offset } }];
    });
  }

  function focusDrawing(id: number) {
    setActiveId(id);
    // Move to the end of the array so its zIndex (80 + index) puts it on top.
    setDrawingWindows((current) => {
      const target = current.find((w) => w.id === id);
      if (!target) return current;
      return [...current.filter((w) => w.id !== id), target];
    });
  }

  function closeDrawing(id: number) {
    setDrawingWindows((current) => current.filter((w) => w.id !== id));
    setActiveId((current) => (current === id ? null : current));
    setSavingId((current) => (current === id ? null : current));
  }

  // Clicking outside any drawing window deactivates the active one.
  useEffect(() => {
    if (!enableDrawing) return;
    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('[data-drawing-window="true"]')
      ) {
        return;
      }
      setActiveId(null);
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [enableDrawing]);

  return (
    <>
      <div className={cn("border-b border-white/10 px-4 py-4", className)}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          {title != null || subtitle != null ? (
            <div>
              {title != null ? (
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  {title}
                </h1>
              ) : null}
              {subtitle != null ? (
                <p className="mt-1 text-xs text-white/50">{subtitle}</p>
              ) : null}
            </div>
          ) : null}

          {hasActionCluster ? (
            <div className="flex flex-wrap items-center gap-2">
              {enableDrawing ? (
                <button
                  type="button"
                  onClick={openDrawing}
                  className="border border-white/20 px-3 py-1.5 text-sm transition-colors hover:bg-white/10"
                >
                  new drawing
                </button>
              ) : null}
              {onModeChange ? (
                <div className="flex border border-white/20">
                  {modes.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onModeChange(option)}
                      className={cn(
                        "px-3 py-1.5 text-sm transition-colors",
                        mode === option ? "bg-white text-black" : "hover:bg-white/10",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : null}
              {actions}
            </div>
          ) : null}
        </div>

        {showFormatRow ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {onFormat
              ? formatActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => onFormat(action)}
                    className="border border-white/20 px-3 py-1 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {action.label.toLowerCase()}
                  </button>
                ))
              : null}
            {status != null ? (
              <span className="ml-auto text-xs text-white/60">{status}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {enableDrawing
        ? drawingWindows.map((windowState, index) => (
            <DrawingWindow
              key={windowState.id}
              active={windowState.id === activeId}
              initialPosition={windowState.position}
              darkMapping={drawingDarkMapping}
              zIndex={80 + index}
              title={`drawing #${windowState.id}`}
              subtitle={drawingSubtitle}
              disableSave={savingId !== null && savingId !== windowState.id}
              onClose={() => closeDrawing(windowState.id)}
              onFocus={() => focusDrawing(windowState.id)}
              onSave={async (result) => {
                setSavingId(windowState.id);
                try {
                  await onSaveDrawing?.(result);
                  closeDrawing(windowState.id);
                } finally {
                  setSavingId((current) =>
                    current === windowState.id ? null : current,
                  );
                }
              }}
            />
          ))
        : null}
    </>
  );
}
