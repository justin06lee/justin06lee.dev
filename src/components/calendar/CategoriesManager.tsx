"use client";

import { useState } from "react";
import type { CalendarCategory } from "@/lib/calendar-categories";
import { CATEGORY_PALETTE } from "@/lib/colors";
import CategoryCreateInline from "./CategoryCreateInline";
import { ManagerTable, type ManagerRow } from "@/components/chrome/manager-table";

type Props = { initial: CalendarCategory[] };

// Stable module-level array so ManagerTable's palette-keyed memo isn't defeated
// by a fresh literal every render.
const PALETTE_HEXES: string[] = CATEGORY_PALETTE.map((p) => p.hex);

export default function CategoriesManager({ initial }: Props) {
  const [categories, setCategories] = useState<CalendarCategory[]>(initial);
  // Top-level banner for recolor/archive failures — those callbacks are
  // fire-and-forget in ManagerTable (no inline error channel). Rename and
  // delete failures surface inline under the row via ManagerTable instead.
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function patchReq(id: string, body: Record<string, unknown>) {
    return fetch(`/api/calendar/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
  }

  // Rename throws on failure so ManagerTable rolls the inline draft back and
  // shows the error under the row.
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
    setError(null);
    const r = await patchReq(id, { color: hex });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      // State stays put, so ManagerTable's controlled swatch snaps back.
      setError(e.error ?? "Failed to update");
      return;
    }
    const updated = (await r.json()) as CalendarCategory;
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }

  async function archive(id: string, archived: boolean) {
    setError(null);
    const r = await patchReq(id, { archived });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      setError(e.error ?? "Failed to update");
      return;
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
      {error && <div className="text-sm text-red-400">{error}</div>}

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
        palette={PALETTE_HEXES}
        onRename={rename}
        onRecolor={(id, hex) => void recolor(id, hex)}
        onArchive={(id, archived) => void archive(id, archived)}
        onDelete={remove}
      />
    </div>
  );
}
