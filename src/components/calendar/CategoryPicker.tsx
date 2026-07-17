"use client";

import { useEffect, useMemo, useState } from "react";
import type { CalendarCategory } from "@/lib/calendar-categories";
import CategoryCreateInline from "./CategoryCreateInline";
import { Combobox, type ComboboxOption } from "@/components/chrome/combobox";

type Props = {
  selectedId: string | null;
  onChange: (id: string | null) => void;
  /** Server-loaded categories, threaded through to avoid one fetch per picker
   *  mount. If omitted, falls back to fetching `/api/calendar/categories`. */
  categories?: CalendarCategory[];
};

export default function CategoryPicker({ selectedId, onChange, categories: initialCategories }: Props) {
  const [categories, setCategories] = useState<CalendarCategory[]>(initialCategories ?? []);
  // If a server-provided list is present we never need to fetch.
  const [loaded, setLoaded] = useState(initialCategories !== undefined);
  // Holds the create-form's seed name while creating; null when picking.
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    if (loaded) return;
    let cancelled = false;
    (async () => {
      const r = await fetch("/api/calendar/categories", { credentials: "include" });
      if (cancelled || !r.ok) return;
      const list = (await r.json()) as CalendarCategory[];
      setCategories(list);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded]);

  const options = useMemo<ComboboxOption<string>[]>(() => {
    // Active categories, plus the currently-selected one even if archived so
    // the trigger can still render its name.
    return categories
      .filter((c) => !c.archived || c.id === selectedId)
      .map((c) => ({ value: c.id, label: c.name, color: c.color }));
  }, [categories, selectedId]);

  // Inline create flow: picking "+ Create" swaps the picker for the
  // name+color form (chrome Input + ColorSwatchPicker), then re-selects.
  if (creating !== null) {
    return (
      <CategoryCreateInline
        initialName={creating}
        existingCategories={categories}
        onCreated={(cat) => {
          setCategories((prev) => [...prev, cat]);
          onChange(cat.id);
          setCreating(null);
        }}
        onCancel={() => setCreating(null)}
      />
    );
  }

  return (
    <Combobox<string>
      value={selectedId}
      onChange={onChange}
      options={options}
      placeholder="No category"
      searchPlaceholder="Search categories..."
      allowClear
      onCreate={(query) => setCreating(query)}
      ariaLabel="Category"
    />
  );
}
