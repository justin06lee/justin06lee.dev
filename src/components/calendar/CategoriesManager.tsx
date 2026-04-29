"use client";

import { useState } from "react";
import type { CalendarCategory } from "@/lib/calendar-categories";
import { CATEGORY_PALETTE } from "@/lib/colors";
import CategoryCreateInline from "./CategoryCreateInline";
import { useDialog } from "@/components/Dialog";

type Props = { initial: CalendarCategory[] };

export default function CategoriesManager({ initial }: Props) {
  const [categories, setCategories] = useState<CalendarCategory[]>(initial);
  // Per-row name buffer so the input stays controlled while the user types
  // without firing a PATCH on every keystroke. The categories array remains
  // the source of truth; this map tracks pending edits.
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useDialog();

  function nameValueFor(c: CalendarCategory): string {
    return nameDrafts[c.id] ?? c.name;
  }

  function setPending(id: string, on: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setError(null);
    setPending(id, true);
    const before = categories.find((c) => c.id === id) ?? null;
    try {
      const r = await fetch(`/api/calendar/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setError(e.error ?? "Failed to update");
        // Roll back any optimistic change by re-rendering from `before`.
        if (before) setCategories((prev) => prev.map((c) => (c.id === id ? before : c)));
        // Drop the name draft so the input snaps back to server truth.
        if ("name" in body) {
          setNameDrafts((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }
        return;
      }
      const updated = (await r.json()) as CalendarCategory;
      setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
      if ("name" in body) {
        setNameDrafts((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    } finally {
      setPending(id, false);
    }
  }

  async function remove(c: CalendarCategory) {
    setError(null);
    const ok = await dialog.confirm({
      title: `Delete "${c.name}"?`,
      message: "If this category is in use, the deletion will be blocked.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    setPending(c.id, true);
    try {
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
    } finally {
      setPending(c.id, false);
    }
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
          {categories.map((c) => {
            const pending = pendingIds.has(c.id);
            return (
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
                      aria-label={`Rename ${c.name}`}
                      value={nameValueFor(c)}
                      disabled={pending}
                      onChange={(e) =>
                        setNameDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      onBlur={() => {
                        const v = nameValueFor(c).trim();
                        if (v.length === 0 || v === c.name) {
                          // Revert to current value.
                          setNameDrafts((prev) => {
                            const next = { ...prev };
                            delete next[c.id];
                            return next;
                          });
                          return;
                        }
                        void patch(c.id, { name: v });
                      }}
                      className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-white/60 outline-none w-full disabled:opacity-50"
                    />
                  )}
                </td>
                <td className="py-2">
                  <select
                    aria-label={`Color for ${c.name}`}
                    value={c.color}
                    disabled={pending}
                    onChange={(e) => void patch(c.id, { color: e.target.value })}
                    className="bg-transparent border border-white/20 px-1 py-0.5 text-xs disabled:opacity-50"
                  >
                    {CATEGORY_PALETTE.map((p) => (
                      <option key={p.hex} value={p.hex} style={{ backgroundColor: p.hex }}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void patch(c.id, { archived: !c.archived })}
                    className="text-xs text-white/60 hover:text-white disabled:opacity-50"
                  >
                    {c.archived ? "Unarchive" : "Archive"}
                  </button>
                </td>
                <td className="py-2 text-right">
                  {!c.isSystem && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void remove(c)}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
