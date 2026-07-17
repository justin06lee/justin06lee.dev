"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
  /** Optional node rendered before the label — e.g. a color swatch. */
  prefix?: ReactNode;
  disabled?: boolean;
};

type Props<T extends string | number> = {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  /** Match the visual size of the trigger to e.g. an inline table cell. */
  size?: "default" | "compact";
  /** CSS background applied to the root element. Transparent by default. */
  background?: string;
};

export default function Select<T extends string | number>({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  ariaLabel,
  className,
  size = "default",
  background,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const baseId = useId();
  const optionId = (i: number) => `${baseId}-option-${i}`;

  // Focus the listbox (so its onKeyDown handles Arrow/Enter/Escape) and close on
  // outside click. The active-index init lives in the trigger handler instead, so
  // this effect never calls setState — no cascading renders.
  useEffect(() => {
    if (!open) return;
    listboxRef.current?.focus();
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      setActiveIndex(-1);
    } else {
      // Highlight the selected option (or the first) as we open.
      const selectedIndex = options.findIndex((o) => o.value === value);
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      setOpen(true);
    }
  };

  const selected = options.find((o) => o.value === value) ?? null;

  const move = (dir: 1 | -1) => {
    if (options.length === 0) return;
    setActiveIndex((i) => {
      const start = i < 0 ? (dir === 1 ? -1 : 0) : i;
      let next = start;
      // Skip disabled options, wrapping around.
      for (let step = 0; step < options.length; step++) {
        next += dir;
        if (next < 0) next = options.length - 1;
        if (next > options.length - 1) next = 0;
        if (!options[next]?.disabled) return next;
      }
      return i;
    });
  };

  const selectAt = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    setOpen(false);
    // Closing unmounts the focused listbox — return focus to the trigger so
    // it doesn't fall back to document.body.
    triggerRef.current?.focus();
  };

  function onListboxKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(-1);
        move(1);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(-1);
        move(-1);
        break;
      case "Enter":
        if (activeIndex >= 0) {
          e.preventDefault();
          selectAt(activeIndex);
        }
        break;
      case "Escape":
        // Local handler is enough to keep a nested dialog's Escape from also
        // firing, since the listbox is focused and we stop propagation here.
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
        break;
    }
  }
  const triggerPad = size === "compact" ? "px-2 py-0.5 text-xs" : "px-2 py-1 text-sm";
  const optionPad = size === "compact" ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm";

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`} style={{ background }}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleOpen}
        className={`w-full flex items-center gap-2 border border-white/20 ${triggerPad} text-left hover:bg-white/5 disabled:opacity-50`}
      >
        {selected ? (
          <>
            {selected.prefix}
            <span className="truncate">{selected.label}</span>
          </>
        ) : (
          <span className="text-white/50 truncate">{placeholder ?? "Select…"}</span>
        )}
        <span className="ml-auto text-white/30">▾</span>
      </button>

      {open && (
        <div
          ref={listboxRef}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          onKeyDown={onListboxKeyDown}
          className="absolute top-full left-0 right-0 z-30 mt-1 border border-white/20 bg-black max-h-72 overflow-auto outline-none"
        >
          {options.map((o, i) => {
            const active = o.value === value;
            const highlighted = i === activeIndex;
            return (
              <button
                key={String(o.value)}
                id={optionId(i)}
                type="button"
                role="option"
                aria-selected={active}
                disabled={o.disabled}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => selectAt(i)}
                className={`w-full flex items-center gap-2 ${optionPad} text-left disabled:opacity-40 ${active || highlighted ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10"}`}
              >
                {o.prefix}
                <span className="truncate">{o.label}</span>
              </button>
            );
          })}
          {options.length === 0 && (
            <div className={`${optionPad} text-white/40`}>No options</div>
          )}
        </div>
      )}
    </div>
  );
}
