"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileCard } from "@/components/chrome/file-card";
import { Input } from "@/components/chrome/input";
import { Button } from "@/components/chrome/button";

export type FileGridFile = {
  id: string;
  /** file name; also the string the confirm dialog asks the user to type. */
  name: string;
  /** link target forwarded to the default card. */
  href?: string;
  /** kicker line forwarded to the default card, e.g. "pdf · 1.2 mb". */
  meta?: string;
};

export type FileGridProps<T extends FileGridFile> = {
  /** the files to render. extra fields ride along into onDelete/renderCard. */
  files: T[];
  /**
   * Enables deleting: press-and-drag a card onto the trash zone (which only
   * appears while a card is being dragged), then type the exact file name in
   * the confirm dialog. May return a promise — a rejection surfaces inline.
   */
  onDelete?: (file: T) => void | Promise<void>;
  /** replaces the default file-card render for each file. */
  renderCard?: (file: T) => React.ReactNode;
  /** anchor element/component forwarded to the default card. default "a". */
  linkComponent?: React.ElementType;
  /** where the trash drop zone sits while dragging. default "corner" (inside the grid). */
  trashPosition?: "corner" | "viewport";
  /** shown when files is empty. default "no files yet." */
  emptyLabel?: string;
  className?: string;
};

// Subtle entrance for the confirm dialog; disabled under reduced motion.
const FILE_GRID_KEYFRAMES = `@keyframes chrome-file-grid-overlay {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes chrome-file-grid-panel {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.chrome-file-grid-overlay { animation: chrome-file-grid-overlay 120ms ease-out; }
.chrome-file-grid-panel { animation: chrome-file-grid-panel 150ms cubic-bezier(0.2, 0.8, 0.2, 1); }
@media (prefers-reduced-motion: reduce) {
  .chrome-file-grid-overlay, .chrome-file-grid-panel { animation: none; }
}`;

// How far the pointer must travel before a press becomes a drag (vs a click
// that follows the card's link). Below this, the card navigates as normal.
const DRAG_THRESHOLD = 6;

/**
 * Asset-browser grid of stacked-paper file cards with a delete flow: press and
 * drag a card onto the trash zone — which only appears while dragging — then
 * type the exact file name to confirm. Dragging is pointer-driven, so it never
 * triggers the browser's native link-drag (a plain click still opens the
 * card's href). `onDelete` may be async; the dialog surfaces rejections inline.
 */
export function FileGrid<T extends FileGridFile>({
  files,
  onDelete,
  renderCard,
  linkComponent,
  trashPosition = "corner",
  emptyLabel = "no files yet.",
  className,
}: FileGridProps<T>) {
  const [dragging, setDragging] = React.useState<T | null>(null);
  const [dropActive, setDropActive] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<T | null>(null);
  const [confirmValue, setConfirmValue] = React.useState("");
  const [deleteError, setDeleteError] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);

  const panelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const trashRef = React.useRef<HTMLDivElement>(null);
  const ghostRef = React.useRef<HTMLDivElement>(null);
  // A drag that moved past the threshold suppresses the click that would
  // otherwise follow pointerup on the card's link (so it doesn't navigate).
  const suppressClickRef = React.useRef(false);
  // Element focused before the dialog opened, restored on close.
  const previouslyFocused = React.useRef<HTMLElement | null>(null);

  const deletable = Boolean(onDelete);
  const open = pendingDelete !== null;
  const canConfirm = pendingDelete !== null && confirmValue.trim() === pendingDelete.name;

  const openConfirm = React.useCallback((file: T) => {
    setPendingDelete(file);
    setConfirmValue("");
    setDeleteError("");
  }, []);

  const closeConfirm = React.useCallback(() => {
    setPendingDelete(null);
    setConfirmValue("");
    setDeleteError("");
  }, []);

  const overTrash = React.useCallback((x: number, y: number) => {
    const el = trashRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }, []);

  // Pointer-driven drag. HTML5 DnD on an <a> drags the URL (and can navigate);
  // tracking the pointer ourselves avoids that entirely and lets a plain click
  // still open the card. The trash zone is mounted only once a drag starts.
  const startDrag = React.useCallback(
    (e: React.PointerEvent, file: T) => {
      if (!deletable || e.button !== 0) return;
      suppressClickRef.current = false;
      const st = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };

      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== st.pointerId) return;
        if (!st.moved && Math.hypot(ev.clientX - st.startX, ev.clientY - st.startY) < DRAG_THRESHOLD) {
          return;
        }
        if (!st.moved) {
          st.moved = true;
          setDragging(file); // mounts the trash zone + ghost
        }
        if (ghostRef.current) {
          ghostRef.current.style.transform = `translate3d(${ev.clientX + 14}px, ${ev.clientY + 14}px, 0)`;
        }
        setDropActive(overTrash(ev.clientX, ev.clientY));
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", cancel);
        setDragging(null);
        setDropActive(false);
      };

      function finish(ev: PointerEvent) {
        if (st.moved) {
          // Real drag: block the imminent click and, if over the trash, delete.
          suppressClickRef.current = true;
          if (overTrash(ev.clientX, ev.clientY)) openConfirm(file);
        }
        cleanup();
      }

      function cancel() {
        cleanup();
      }

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", cancel);
    },
    [deletable, openConfirm, overTrash],
  );

  async function confirmDelete() {
    if (!pendingDelete || !canConfirm || deleting) return;
    setDeleteError("");
    setDeleting(true);
    try {
      await onDelete?.(pendingDelete);
      closeConfirm();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "unable to delete file.");
    } finally {
      setDeleting(false);
    }
  }

  // Capture the previously focused element and move focus to the input.
  React.useEffect(() => {
    if (!open) return;
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus();
      previouslyFocused.current = null;
    };
  }, [open]);

  // Lock body scroll while the dialog is open.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape closes; Tab/Shift+Tab cycle within the dialog's focusables.
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeConfirm();
        return;
      }
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || !panel.contains(active)) {
            e.preventDefault();
            last?.focus();
          }
        } else if (active === last || !panel.contains(active)) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeConfirm]);

  return (
    <div className={cn("relative", className)}>
      {files.length === 0 ? (
        <div className="border border-dashed border-white/15 px-6 py-10 text-center font-mono text-xs text-white/40">
          {emptyLabel}
        </div>
      ) : (
        <div className="flex flex-wrap gap-8">
          {files.map((file) => (
            <div
              key={file.id}
              onPointerDown={(e) => startDrag(e, file)}
              // Cancel the browser's native drag (an <a> would otherwise drag its
              // URL and try to navigate). Our pointer handler owns dragging.
              onDragStart={(e) => e.preventDefault()}
              // Swallow the click that follows a real drag so the card's link
              // doesn't open; a plain click (no drag) passes through untouched.
              onClickCapture={(e) => {
                if (suppressClickRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  suppressClickRef.current = false;
                }
              }}
              className={cn(
                "relative",
                deletable && "cursor-grab select-none touch-none active:cursor-grabbing",
                dragging?.id === file.id && "opacity-40",
              )}
            >
              {renderCard ? (
                renderCard(file)
              ) : (
                <FileCard
                  name={file.name}
                  meta={file.meta}
                  href={file.href}
                  linkComponent={linkComponent}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Trash drop zone — mounted only while a card is being dragged. Purely
          visual (pointer-events-none); the drop is detected by hit-testing the
          pointer against this element's rect in the drag handler. */}
      {deletable && dragging && (
        <div
          className={cn(
            "pointer-events-none z-[60]",
            trashPosition === "viewport" ? "fixed bottom-6 right-6" : "absolute -bottom-2 -right-2",
          )}
        >
          <div
            ref={trashRef}
            aria-hidden
            className={cn(
              "flex size-16 items-center justify-center border bg-black transition-all motion-reduce:transition-none",
              dropActive
                ? "scale-110 border-red-400/60 bg-red-400/10 text-red-300"
                : "border-white/30 text-white",
            )}
          >
            <Trash2 size={20} />
          </div>
        </div>
      )}

      {/* Drag ghost following the pointer. Starts off-screen so it never flashes
          at the origin before the first pointermove positions it. */}
      {deletable && dragging && (
        <div
          ref={ghostRef}
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 z-[70]"
          style={{ transform: "translate3d(-9999px, -9999px, 0)" }}
        >
          <div className="border border-white/30 bg-black px-3 py-2 text-xs text-white/80 shadow-lg">
            {dragging.name}
          </div>
        </div>
      )}

      {pendingDelete && (
        <>
          <style precedence="default" href="chrome-file-grid-keyframes">
            {FILE_GRID_KEYFRAMES}
          </style>
          <div
            className="chrome-file-grid-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4"
            onClick={closeConfirm}
          >
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="chrome-file-grid-title"
              className="chrome-file-grid-panel w-full max-w-sm border border-white/20 bg-black p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void confirmDelete();
                }}
              >
                <div className="space-y-2">
                  <div className="font-mono text-xs uppercase tracking-widest text-white/50">
                    confirm delete
                  </div>
                  <div id="chrome-file-grid-title" className="text-sm text-white">
                    delete <span className="font-medium">{pendingDelete.name}</span>?
                  </div>
                  <div className="text-xs text-white/60">
                    this can&apos;t be undone. type the exact name to confirm.
                  </div>
                </div>
                <Input
                  ref={inputRef}
                  value={confirmValue}
                  onChange={(e) => setConfirmValue(e.target.value)}
                  placeholder={pendingDelete.name}
                  aria-label="type the file name to confirm"
                  className="w-full"
                />
                {deleteError && <p className="text-xs text-red-300">{deleteError}</p>}
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={closeConfirm}>
                    cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={!canConfirm || deleting}
                    className="border-red-400/60 text-red-300 hover:bg-red-400/10"
                  >
                    {deleting ? "deleting…" : "delete"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
