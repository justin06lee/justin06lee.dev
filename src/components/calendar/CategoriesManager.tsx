"use client";

import { useState } from "react";
import type { CalendarCategory } from "@/lib/calendar-categories";
import { CATEGORY_PALETTE } from "@/lib/colors";
import CategoryCreateInline from "./CategoryCreateInline";
import {
  ManagerTable,
  type ManagerRow,
  type ManagerPaletteEntry,
} from "@/components/chrome/manager-table";

type Props = { initial: CalendarCategory[] };

// Stable module-level palette so ManagerTable's palette-keyed memo isn't
// defeated by a fresh literal every render. { value, name } lets the recolor
// swatch show the friendly color name (e.g. "sage") in its tooltip/aria-label
// instead of the raw hex.
const PALETTE: ManagerPaletteEntry[] = CATEGORY_PALETTE.map((p) => ({
  value: p.hex,
  name: p.name,
}));

export default function CategoriesManager({ initial }: Props) {
  const [categories, setCategories] = useState<CalendarCategory[]>(initial);
  const [creating, setCreating] = useState(false);

  function patchReq(id: string, body: Record<string, unknown>) {
    return fetch(`/api/calendar/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
  }

  // Every mutation throws on failure so ManagerTable surfaces the error inline
  // under the affected row (and rolls the rename draft / recolor swatch back).
  async function rename(id: string, name: string) {
    const r = await patchReq(id, { name });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error ?? "Failed to update");
    }
    const updated = (await r.json()) as CalendarCategory;
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }

  async function recolor(id: string, hex: string) {
    const r = await patchReq(id, { color: hex });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error ?? "Failed to update");
    }
    const updated = (await r.json()) as CalendarCategory;
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }

  async function archive(id: string, archived: boolean) {
    const r = await patchReq(id, { archived });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error ?? "Failed to update");
    }
    const updated = (await r.json()) as CalendarCategory;
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }

  // Delete throws on failure (ManagerTable already ran the confirm) so the
  // "in use" case blocks the delete and surfaces inline under the row.
  async function remove(id: string) {
    const r = await fetch(`/api/calendar/categories/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      if (e.planCount !== undefined || e.actualCount !== undefined) {
        throw new Error(`In use by ${e.planCount} plans and ${e.actualCount} actuals — reassign or archive first.`);
      }
      throw new Error(e.error ?? "Failed to delete");
    }
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  // Sleep is the built-in system category: locked (no rename/delete), but
  // recolor and archive still work.
  const rows: ManagerRow[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    archived: c.archived,
    locked: c.isSystem,
  }));

  return (
    <div className="space-y-4">
      {creating ? (
        <CategoryCreateInline
          initialName=""
          existingCategories={categories}
          onCreated={(c) => {
            setCategories((prev) => [...prev, c]);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="border border-dashed border-white/20 hover:bg-white/5 px-3 py-2 text-sm text-white/70"
        >
          + New category
        </button>
      )}

      <ManagerTable
        rows={rows}
        palette={PALETTE}
        onRename={rename}
        onRecolor={recolor}
        onArchive={archive}
        onDelete={remove}
      />
    </div>
  );
}
