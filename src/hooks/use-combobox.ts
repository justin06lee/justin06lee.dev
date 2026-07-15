"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type ComboboxOption<T extends string | number> = {
  value: T;
  label: string;
  /** Optional color swatch shown before the label. */
  color?: string;
};

export type UseComboboxOptions<T extends string | number> = {
  value: T | null;
  options: ComboboxOption<T>[];
};

export type UseComboboxReturn<T extends string | number> = {
  open: boolean;
  setOpen: (open: boolean) => void;
  query: string;
  setQuery: (q: string) => void;
  /** Options filtered by the current query (case-insensitive label match). */
  filtered: ComboboxOption<T>[];
  selected: ComboboxOption<T> | null;
  /** Wrap trigger + dropdown; outside click / Escape closes and resets query. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Index of the keyboard-highlighted row, or -1. */
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  /** Stable id for the listbox element + per-row option ids. */
  listboxId: string;
  rowId: (i: number) => string;
  /**
   * Build the search input's onKeyDown for the given navigable row list.
   * `rowCount` is the total number of highlightable rows (create/clear +
   * filtered options) and `onActivate` runs the row at the highlighted index.
   */
  inputKeyDown: (rowCount: number, onActivate: (i: number) => void) => (e: KeyboardEvent) => void;
};

/**
 * Headless searchable-select behavior: open state, query filtering,
 * outside-click + Escape close. No styling, no opinion on create/clear — the
 * styled Combobox layers those on. Generalized from the calendar CategoryPicker.
 */
export function useCombobox<T extends string | number>({
  value,
  options,
}: UseComboboxOptions<T>): UseComboboxReturn<T> {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const rowId = (i: number) => `${baseId}-row-${i}`;

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(-1);
      return;
    }
    const onPointer = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // Reset the highlight whenever the navigable rows change (filtering or an
  // options update) so it never points at a stale row.
  useEffect(() => {
    setActiveIndex(-1);
  }, [filtered]);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const inputKeyDown =
    (rowCount: number, onActivate: (i: number) => void) => (e: KeyboardEvent) => {
      const move = (dir: 1 | -1) => {
        if (rowCount === 0) return;
        const raw = activeIndex + dir;
        const next = raw < 0 ? rowCount - 1 : raw > rowCount - 1 ? 0 : raw;
        setActiveIndex(next);
        // Keep the highlighted row visible inside the scrollable list.
        document.getElementById(rowId(next))?.scrollIntoView({ block: "nearest" });
      };
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          move(1);
          break;
        case "ArrowUp":
          e.preventDefault();
          move(-1);
          break;
        case "Enter":
          if (activeIndex >= 0 && activeIndex < rowCount) {
            e.preventDefault();
            onActivate(activeIndex);
          }
          break;
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
          break;
      }
    };

  return {
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
  };
}
