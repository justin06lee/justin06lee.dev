"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value) ?? null;
  const triggerPad = size === "compact" ? "px-2 py-0.5 text-xs" : "px-2 py-1 text-sm";
  const optionPad = size === "compact" ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm";

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
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
          role="listbox"
          className="absolute top-full left-0 right-0 z-30 mt-1 border border-white/20 bg-black max-h-72 overflow-auto"
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={String(o.value)}
                type="button"
                role="option"
                aria-selected={active}
                disabled={o.disabled}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 ${optionPad} text-left disabled:opacity-40 ${active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10"}`}
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
