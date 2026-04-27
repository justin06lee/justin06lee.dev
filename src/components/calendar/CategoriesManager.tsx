"use client";

import { useState } from "react";
import type { CalendarCategory } from "@/lib/calendar-categories";
import { CATEGORY_PALETTE } from "@/lib/colors";
import CategoryCreateInline from "./CategoryCreateInline";

type Props = { initial: CalendarCategory[] };

export default function CategoriesManager({ initial }: Props) {
  const [categories, setCategories] = useState<CalendarCategory[]>(initial);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    setError(null);
    const r = await fetch(`/api/calendar/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      setError(e.error ?? "Failed to update");
      return;
    }
    const updated = (await r.json()) as CalendarCategory;
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
  }

  async function remove(c: CalendarCategory) {
    setError(null);
    if (!confirm(`Delete "${c.name}"?`)) return;
    const r = await fetch(`/api/calendar/categories/${c.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      if (e.planCount !== undefined || e.actualCount !== undefined) {
        setError(`In use by ${e.planCount} plans and ${e.actualCount} actuals — reassign or archive first.`);
      } else {
        setError(e.error ?? "Failed to delete");
      }
      return;
    }
    setCategories((prev) => prev.filter((x) => x.id !== c.id));
  }

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

      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wider text-white/50">
          <tr>
            <th className="text-left py-2 w-8"></th>
            <th className="text-left py-2">Name</th>
            <th className="text-left py-2">Color</th>
            <th className="text-right py-2">Status</th>
            <th className="text-right py-2 w-32">Actions</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id} className="border-t border-white/10">
              <td className="py-2">
                <span
                  className="h-3 w-3 inline-block border border-white/30"
                  style={{ backgroundColor: c.color }}
                />
              </td>
              <td className="py-2 text-white/90">
                {c.isSystem ? (
                  <span>{c.name} <span className="text-[10px] text-white/40">system</span></span>
                ) : (
                  <input
                    defaultValue={c.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== c.name) void patch(c.id, { name: v });
                    }}
                    className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-white/60 outline-none w-full"
                  />
                )}
              </td>
              <td className="py-2">
                <select
                  defaultValue={c.color}
                  onChange={(e) => void patch(c.id, { color: e.target.value })}
                  className="bg-transparent border border-white/20 px-1 py-0.5 text-xs"
                >
                  {CATEGORY_PALETTE.map((p) => (
                    <option key={p.hex} value={p.hex} style={{ backgroundColor: p.hex }}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-2 text-right">
                {c.archived ? (
                  <button
                    type="button"
                    onClick={() => void patch(c.id, { archived: false })}
                    className="text-xs text-white/60 hover:text-white"
                  >
                    Unarchive
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void patch(c.id, { archived: true })}
                    className="text-xs text-white/60 hover:text-white"
                  >
                    Archive
                  </button>
                )}
              </td>
              <td className="py-2 text-right">
                {!c.isSystem && (
                  <button
                    type="button"
                    onClick={() => void remove(c)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
