"use client";

import { cn } from "@/lib/utils";
import { useTabs, type TabItem } from "@/hooks/use-tabs";

export type { TabItem } from "@/hooks/use-tabs";

export type TabsProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  items: TabItem<T>[];
  className?: string;
  /** Loop arrow-key focus past the ends. Defaults to true. */
  loop?: boolean;
};

/**
 * Bordered pill tab-strip. Renders the tab buttons only — render your own panel
 * by `value`. Behavior (selection, roving tabindex, arrow keys, ARIA) comes from
 * the headless `useTabs` hook.
 */
export function Tabs<T extends string>({
  value,
  onValueChange,
  items,
  className,
  loop,
}: TabsProps<T>) {
  const { tabListProps, getTabProps } = useTabs({ value, onValueChange, items, loop });

  return (
    <div {...tabListProps} className={cn("flex gap-2", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            {...getTabProps(item.value)}
            className={cn(
              "whitespace-nowrap border px-3 py-1.5 text-sm transition-colors",
              "focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50",
              item.disabled && "cursor-not-allowed opacity-40",
              active
                ? "border-white text-white"
                : "border-white/20 text-white/60 hover:border-white/50 hover:text-white",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
