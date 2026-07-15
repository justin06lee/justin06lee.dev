"use client";

import { useState } from "react";
import { CATEGORY_PALETTE, pickNextUnusedColor } from "@/lib/colors";
import type { CalendarCategory } from "@/lib/calendar-categories";
import { Input } from "@/components/chrome/input";
import { Button } from "@/components/chrome/button";
import { ColorSwatchPicker } from "@/components/chrome/color-swatch";

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
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Category name"
        className="w-full"
      />
      {/* Palette restricted to the app's 8 category hexes. */}
      <ColorSwatchPicker value={color} onChange={setColor} palette={CATEGORY_PALETTE} ariaLabel="Category color" />
      {error && <div className="text-xs text-red-400">{error}</div>}
      <div className="flex gap-2 justify-end">
        <Button variant="link" size="sm" onClick={onCancel} className="text-white/60 hover:text-white">
          Cancel
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={submit}
          disabled={submitting || name.trim().length === 0}
        >
          {submitting ? "Creating..." : "Create"}
        </Button>
      </div>
    </div>
  );
}
