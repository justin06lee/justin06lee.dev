"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { InlineEdit } from "@/components/chrome/inline-edit";
import { ColorSwatchPicker, type PaletteColor } from "@/components/chrome/color-swatch";
import { useDialog } from "@/components/chrome/dialog";

export type ManagerRow = {
  id: string;
  name: string;
  color?: string;
  archived?: boolean;
  /**
   * Locked (built-in / system) rows render without rename and delete
   * affordances — recolor and archive still work.
   */
  locked?: boolean;
};

/** Sensible muted default palette for recoloring rows. */
export const DEFAULT_MANAGER_PALETTE: readonly string[] = [
  "#5b7a8a",
  "#7a6b5b",
  "#6b8a72",
  "#7a5b78",
  "#8a7a5b",
  "#8a6655",
  "#7a8085",
  "#5b5b8a",
] as const;

// Stable default for the `palette` prop — a fresh array literal in the
// parameter default would defeat the palette-keyed useMemo every render.
const DEFAULT_PALETTE: string[] = [...DEFAULT_MANAGER_PALETTE];

export type ManagerTableProps = {
  /** Rows to render — the source of truth, owned by the caller. */
  rows: ManagerRow[];
  /** Hex colors offered by the recolor swatch picker. */
  palette?: string[];
  /**
   * Commit a renamed row. May be async: the draft name shows optimistically
   * while it runs; reject (or throw) to roll the name back and surface the
   * error under the row.
   */
  onRename?: (id: string, name: string) => void | Promise<void>;
  /** Commit a recolored row. */
  onRecolor?: (id: string, color: string) => void;
  /** Toggle a row's archived flag. */
  onArchive?: (id: string, archived: boolean) => void;
  /**
   * Delete a row (already confirmed). May be async: reject (or throw) to
   * block the delete — the row stays and the error surfaces under it.
   */
  onDelete?: (id: string) => void | Promise<void>;
  className?: string;
};

/** Normalize a rejection into a printable message. */
function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err.trim().length > 0) return err;
  return fallback;
}

/**
 * Admin table of rows you can inline-rename, recolor, archive, and delete.
 * Every mutation is a callback — bring your own state. Delete asks for a
 * confirm first via the dialog provider. Archived rows render muted. Locked
 * rows can't be renamed or deleted. Rename and delete handlers may return a
 * promise — while one runs the row's actions are disabled, and a rejection
 * surfaces inline under the row (a rejected rename also rolls the name back).
 */
export function ManagerTable({
  rows,
  palette = DEFAULT_PALETTE,
  onRename,
  onRecolor,
  onArchive,
  onDelete,
  className,
}: ManagerTableProps) {
  const dialog = useDialog();
  // Rows with an in-flight rename/delete (their actions are disabled).
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Per-row error from the last rejected rename/delete.
  const [errors, setErrors] = React.useState<Readonly<Record<string, string>>>(
    {},
  );

  const paletteColors = React.useMemo<readonly PaletteColor[]>(
    () => palette.map((hex) => ({ name: hex, hex })),
    [palette],
  );

  function setRowPending(id: string, on: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function setRowError(id: string, message: string | null) {
    setErrors((prev) => {
      const next = { ...prev };
      if (message === null) delete next[id];
      else next[id] = message;
      return next;
    });
  }

  /**
   * Run a row mutation: clear the row's error, mark it pending, and turn a
   * rejection into an inline error. Resolves true on success.
   */
  async function runRowAction(
    id: string,
    fallback: string,
    action: () => void | Promise<void>,
  ): Promise<boolean> {
    setRowError(id, null);
    setRowPending(id, true);
    try {
      await action();
      return true;
    } catch (err) {
      setRowError(id, toErrorMessage(err, fallback));
      return false;
    } finally {
      setRowPending(id, false);
    }
  }

  async function handleDelete(row: ManagerRow) {
    const ok = await dialog.confirm({
      title: `Delete "${row.name}"?`,
      message: "This cannot be undone.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    await runRowAction(row.id, "delete failed", () => onDelete?.(row.id));
  }

  return (
    <table className={cn("w-full text-sm", className)}>
      <thead className="text-xs uppercase tracking-wider text-white/50">
        <tr>
          <th className="text-left py-2">Name</th>
          <th className="text-left py-2">Color</th>
          <th className="text-right py-2">Status</th>
          <th className="text-right py-2 w-32">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const archived = row.archived ?? false;
          const pending = pendingIds.has(row.id);
          const error = errors[row.id];
          return (
            <React.Fragment key={row.id}>
              <tr
                className={cn(
                  "border-t border-white/10",
                  archived && "opacity-40",
                )}
              >
                <td className="py-2 pr-3 text-white/90">
                  {row.locked ? (
                    <span className="inline-flex items-baseline gap-1.5 py-1">
                      <span>{row.name}</span>
                      <span className="text-[10px] lowercase text-white/40">
                        locked
                      </span>
                    </span>
                  ) : (
                    <InlineEdit
                      aria-label={`Rename ${row.name}`}
                      value={row.name}
                      disabled={pending}
                      onCommit={async (next) => {
                        const ok = await runRowAction(row.id, "rename failed", () =>
                          onRename?.(row.id, next),
                        );
                        // Reject so InlineEdit rolls the draft back to `value`.
                        if (!ok) throw new Error("rename failed");
                      }}
                    />
                  )}
                </td>
                <td className="py-2 pr-3">
                  <ColorSwatchPicker
                    ariaLabel={`Color for ${row.name}`}
                    value={row.color ?? null}
                    palette={paletteColors}
                    onChange={(hex) => onRecolor?.(row.id, hex)}
                    className={cn(pending && "pointer-events-none opacity-50")}
                  />
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onArchive?.(row.id, !archived)}
                    className="text-xs text-white/60 hover:text-white disabled:opacity-50"
                  >
                    {archived ? "Unarchive" : "Archive"}
                  </button>
                </td>
                <td className="py-2 text-right">
                  {!row.locked && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void handleDelete(row)}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
              {error !== undefined && (
                <tr>
                  <td
                    colSpan={4}
                    role="alert"
                    className="pb-2 text-xs lowercase text-red-400"
                  >
                    {error}
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
