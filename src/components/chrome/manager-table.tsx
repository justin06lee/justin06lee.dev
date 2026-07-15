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
  /** Commit a renamed row. */
  onRename?: (id: string, name: string) => void;
  /** Commit a recolored row. */
  onRecolor?: (id: string, color: string) => void;
  /** Toggle a row's archived flag. */
  onArchive?: (id: string, archived: boolean) => void;
  /** Delete a row (already confirmed). */
  onDelete?: (id: string) => void;
  className?: string;
};

/**
 * Admin table of rows you can inline-rename, recolor, archive, and delete.
 * Every mutation is a callback — bring your own state. Delete asks for a
 * confirm first via the dialog provider. Archived rows render muted.
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

  const paletteColors = React.useMemo<readonly PaletteColor[]>(
    () => palette.map((hex) => ({ name: hex, hex })),
    [palette],
  );

  async function handleDelete(row: ManagerRow) {
    const ok = await dialog.confirm({
      title: `Delete "${row.name}"?`,
      message: "This cannot be undone.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    onDelete?.(row.id);
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
          return (
            <tr
              key={row.id}
              className={cn(
                "border-t border-white/10",
                archived && "opacity-40",
              )}
            >
              <td className="py-2 pr-3 text-white/90">
                <InlineEdit
                  aria-label={`Rename ${row.name}`}
                  value={row.name}
                  onCommit={(next) => onRename?.(row.id, next)}
                />
              </td>
              <td className="py-2 pr-3">
                <ColorSwatchPicker
                  ariaLabel={`Color for ${row.name}`}
                  value={row.color ?? null}
                  palette={paletteColors}
                  onChange={(hex) => onRecolor?.(row.id, hex)}
                />
              </td>
              <td className="py-2 text-right">
                <button
                  type="button"
                  onClick={() => onArchive?.(row.id, !archived)}
                  className="text-xs text-white/60 hover:text-white"
                >
                  {archived ? "Unarchive" : "Archive"}
                </button>
              </td>
              <td className="py-2 text-right">
                <button
                  type="button"
                  onClick={() => void handleDelete(row)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
