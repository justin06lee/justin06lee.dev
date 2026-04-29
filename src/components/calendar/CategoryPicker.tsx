"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CalendarCategory } from "@/lib/calendar-categories";
import CategoryCreateInline from "./CategoryCreateInline";

type Props = {
  selectedId: string | null;
  onChange: (id: string | null) => void;
  /** Server-loaded categories, threaded through to avoid one fetch per picker
   *  mount. If omitted, falls back to fetching `/api/calendar/categories`. */
  categories?: CalendarCategory[];
};

export default function CategoryPicker({ selectedId, onChange, categories: initialCategories }: Props) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<CalendarCategory[]>(initialCategories ?? []);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  // If a server-provided list is present we never need to fetch.
  const [loaded, setLoaded] = useState(initialCategories !== undefined);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const selected = categories.find((c) => c.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const active = categories.filter((c) => !c.archived);
    if (!query.trim()) return active;
    return active.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  }, [categories, query]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 border border-white/20 px-2 py-1 text-left text-sm hover:bg-white/5"
      >
        {selected ? (
          <>
            <span className="h-3 w-3 inline-block border border-white/30" style={{ backgroundColor: selected.color }} />
            <span className="truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-white/50">No category</span>
        )}
        <span className="ml-auto text-white/30">▾</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 border border-white/20 bg-black max-h-72 overflow-auto">
          {creating ? (
            <CategoryCreateInline
              initialName={query}
              existingCategories={categories}
              onCreated={(cat) => {
                setCategories((prev) => [...prev, cat]);
                onChange(cat.id);
                setCreating(false);
                setOpen(false);
                setQuery("");
              }}
              onCancel={() => setCreating(false)}
            />
          ) : (
            <>
              <input
                autoFocus
                placeholder="Search categories..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent border-b border-white/20 px-3 py-2 text-sm focus:border-white/60 outline-none"
              />
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 border-b border-white/10"
              >
                + Create {query.trim() ? `"${query.trim()}"` : "new category"}
              </button>
              {selectedId !== null && (
                <button
                  type="button"
                  onClick={() => { onChange(null); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-white/50 hover:bg-white/10 border-b border-white/10"
                >
                  Clear category
                </button>
              )}
              {filtered.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => { onChange(c.id); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                >
                  <span className="h-3 w-3 inline-block border border-white/30" style={{ backgroundColor: c.color }} />
                  <span className="truncate">{c.name}</span>
                  {c.isSystem && <span className="ml-auto text-[10px] text-white/40">system</span>}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-xs text-white/40">No matches</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
