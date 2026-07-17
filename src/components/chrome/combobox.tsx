"use client";

import { cn } from "@/lib/utils";
import { useCombobox, type ComboboxOption } from "@/hooks/use-combobox";

export type { ComboboxOption } from "@/hooks/use-combobox";

export type ComboboxProps<T extends string | number> = {
  value: T | null;
  onChange: (value: T | null) => void;
  options: ComboboxOption<T>[];
  placeholder?: string;
  searchPlaceholder?: string;
  /** Show a "Clear" row when something is selected. */
  allowClear?: boolean;
  /** When set, renders a "+ Create {query}" row that calls this with the query. */
  onCreate?: (query: string) => void;
  className?: string;
  ariaLabel?: string;
};

/**
 * Searchable select: a trigger that opens a filterable list, with optional
 * inline create and clear. Color swatches render when an option has `color`.
 * Behavior comes from the headless useCombobox hook. Generalized from the
 * justin06lee.dev CategoryPicker.
 */
export function Combobox<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  allowClear,
  onCreate,
  className,
  ariaLabel,
}: ComboboxProps<T>) {
  const {
    open,
    setOpen,
    query,
    setQuery,
    filtered,
    selected,
    containerRef,
    activeIndex,
    setActiveIndex,
    listboxId,
    rowId,
    inputKeyDown,
  } = useCombobox({ value, options });

  // Navigable rows, in render order: optional create, optional clear, then the
  // filtered options. Activating a row mirrors its onClick exactly.
  const showCreate = Boolean(onCreate);
  const showClear = Boolean(allowClear && value !== null);
  const createIndex = showCreate ? 0 : -1;
  const clearIndex = showClear ? (showCreate ? 1 : 0) : -1;
  const optionsOffset = (showCreate ? 1 : 0) + (showClear ? 1 : 0);
  const rowCount = optionsOffset + filtered.length;

  const activateRow = (i: number) => {
    if (i === createIndex && onCreate) {
      onCreate(query.trim());
      setOpen(false);
      return;
    }
    if (i === clearIndex) {
      onChange(null);
      setOpen(false);
      return;
    }
    const o = filtered[i - optionsOffset];
    if (o) {
      onChange(o.value);
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 border border-white/20 px-2 py-1 text-left text-sm hover:bg-white/5"
      >
        {selected ? (
          <>
            {selected.color && (
              <span
                className="inline-block size-3 border border-white/30"
                style={{ backgroundColor: selected.color }}
              />
            )}
            <span className="truncate">{selected.label}</span>
          </>
        ) : (
          <span className="text-white/50">{placeholder}</span>
        )}
        <span className="ml-auto text-white/30">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 border border-white/20 bg-black">
          <input
            autoFocus
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={activeIndex >= 0 ? rowId(activeIndex) : undefined}
            onKeyDown={inputKeyDown(rowCount, activateRow)}
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border-b border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-white/60"
          />
          <div
            id={listboxId}
            role="listbox"
            className="max-h-72 overflow-auto"
          >

          {showCreate && (
            <button
              type="button"
              id={rowId(createIndex)}
              role="option"
              aria-selected={false}
              onMouseEnter={() => setActiveIndex(createIndex)}
              onClick={() => {
                onCreate?.(query.trim());
                setOpen(false);
              }}
              className={cn(
                "w-full border-b border-white/10 px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10",
                activeIndex === createIndex && "bg-white/10",
              )}
            >
              + Create {query.trim() ? `"${query.trim()}"` : "new"}
            </button>
          )}

          {showClear && (
            <button
              type="button"
              id={rowId(clearIndex)}
              role="option"
              aria-selected={false}
              onMouseEnter={() => setActiveIndex(clearIndex)}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={cn(
                "w-full border-b border-white/10 px-3 py-2 text-left text-xs text-white/50 hover:bg-white/10",
                activeIndex === clearIndex && "bg-white/10",
              )}
            >
              Clear
            </button>
          )}

          {filtered.map((o, i) => (
            <button
              key={String(o.value)}
              id={rowId(optionsOffset + i)}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onMouseEnter={() => setActiveIndex(optionsOffset + i)}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/10",
                activeIndex === optionsOffset + i && "bg-white/10",
                o.value === value ? "text-white" : "text-white/80",
              )}
            >
              {o.color && (
                <span
                  className="inline-block size-3 border border-white/30"
                  style={{ backgroundColor: o.color }}
                />
              )}
              <span className="truncate">{o.label}</span>
            </button>
          ))}

          {filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-white/40">No matches</div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
