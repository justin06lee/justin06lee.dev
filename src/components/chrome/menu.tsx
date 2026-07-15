"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMenu } from "@/hooks/use-menu";

export type MenuItem = {
  label: string;
  onSelect: () => void;
  icon?: LucideIcon;
  /** Shows a filled marker — e.g. the currently-applied sort. */
  selected?: boolean;
  disabled?: boolean;
};

export type MenuProps = {
  /** Trigger contents (text and/or icon). */
  trigger: React.ReactNode;
  items: MenuItem[];
  /** Optional heading above the items. */
  label?: string;
  /** Align the dropdown to the trigger's right edge. Defaults to left. */
  align?: "left" | "right";
  className?: string;
};

/**
 * Action dropdown: a trigger that opens a list of items, each running its
 * onSelect. Behavior (open, outside-click, Escape, arrow keys) comes from the
 * headless useMenu hook.
 */
export function Menu({ trigger, items, label, align = "left", className }: MenuProps) {
  const { open, activeIndex, setActiveIndex, containerRef, itemId, triggerProps, menuProps, onSelect } =
    useMenu({
      itemCount: items.length,
      onActivate: (i) => {
        const item = items[i];
        if (item && !item.disabled) onSelect(item.onSelect);
      },
    });

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        {...triggerProps}
        className="inline-flex items-center gap-2 border border-white/20 px-3 py-1.5 text-sm transition-colors hover:bg-white/5"
      >
        {trigger}
      </button>

      {open && (
        <div
          {...menuProps}
          className={cn(
            "absolute top-full z-30 mt-1 min-w-48 border border-white/10 bg-black",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {label && (
            <>
              <div className="px-3 py-1.5 text-sm text-white/70">{label}</div>
              <div className="h-px bg-white/10" />
            </>
          )}
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                id={itemId(i)}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => onSelect(item.onSelect)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors disabled:opacity-40",
                  i === activeIndex ? "bg-white/10 text-white" : "text-white/70 hover:text-white",
                )}
              >
                {item.selected !== undefined && (
                  <span
                    className={cn(
                      "inline-block size-2 border border-current",
                      item.selected && "bg-white",
                    )}
                  />
                )}
                {Icon && <Icon className="size-4" aria-hidden />}
                <span className="flex-1 truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
