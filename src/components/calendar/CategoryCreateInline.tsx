"use client";

import { useState } from "react";
import { CATEGORY_PALETTE, pickNextUnusedColor } from "@/lib/colors";
import type { CalendarCategory } from "@/lib/calendar-categories";

type Props = {
  initialName: string;
  existingCategories: CalendarCategory[];
  onCreated: (cat: CalendarCategory) => void;
  onCancel: () => void;
};

export default function CategoryCreateInline({ initialName, existingCategories, onCreated, onCancel }: Props) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<string>(() =>
    pickNextUnusedColor(existingCategories.map((c) => c.color)),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const r = await fetch("/api/calendar/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, color }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(body.error ?? "Failed to create");
      setSubmitting(false);
      return;
    }
    const cat = (await r.json()) as CalendarCategory;
    onCreated(cat);
  }

  return (
    <div className="border border-white/20 bg-black p-3 text-sm space-y-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Category name"
        className="w-full bg-transparent border border-white/20 px-2 py-1 text-white focus:border-white/60 outline-none"
      />
      <div className="grid grid-cols-8 gap-2">
        {CATEGORY_PALETTE.map((c) => (
          <button
            key={c.hex}
            type="button"
            onClick={() => setColor(c.hex)}
            aria-label={c.name}
            title={c.name}
            className={`h-6 w-6 border ${color === c.hex ? "border-white" : "border-white/20"}`}
            style={{ backgroundColor: c.hex }}
          />
        ))}
      </div>
      {error && <div className="text-xs text-red-400">{error}</div>}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-white/60 hover:text-white px-2 py-1"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || name.trim().length === 0}
          className="text-xs border border-white/30 hover:bg-white/10 disabled:opacity-40 px-2 py-1"
        >
          {submitting ? "Creating..." : "Create"}
        </button>
      </div>
    </div>
  );
}
