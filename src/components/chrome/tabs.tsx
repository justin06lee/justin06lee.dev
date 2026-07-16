"use client";

import { cn } from "@/lib/utils";
import { useTabs, type TabItem } from "@/hooks/use-tabs";

export type { TabItem } from "@/hooks/use-tabs";

export type TabsProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  items: TabItem<T>[];
  /**
   * Visual style: "pill" (bordered buttons, default) or "underline"
   * (transparent bar with a bottom border; the active tab gets a 2px white
   * underline).
   */
  variant?: "pill" | "underline";
  className?: string;
  /** Loop arrow-key focus past the ends. Defaults to true. */
  loop?: boolean;
};

/**
 * Tab-strip in a bordered pill or underline style. Renders the tab buttons
 * only — render your own panel by `value`. Behavior (selection, roving
 * tabindex, arrow keys, ARIA) comes from the headless `useTabs` hook.
 */
export function Tabs<T extends string>({
  value,
  onValueChange,
  items,
  variant = "pill",
  className,
  loop,
}: TabsProps<T>) {
  const { tabListProps, getTabProps } = useTabs({ value, onValueChange, items, loop });
  const underline = variant === "underline";

  return (
    <div
      {...tabListProps}
      className={cn("flex", underline ? "border-b border-white/10" : "gap-2", className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            {...getTabProps(item.value)}
            className={cn(
              "whitespace-nowrap text-sm transition-colors",
              "focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50",
              item.disabled && "cursor-not-allowed opacity-40",
              underline
                ? cn(
                    // -mb-px overlaps the 2px underline onto the bar's 1px border.
                    "-mb-px border-b-2 px-4 py-2 font-medium",
                    active
                      ? "border-white text-white"
                      : "border-transparent text-white/50 hover:text-white",
                  )
                : cn(
                    "border px-3 py-1.5",
                    active
                      ? "border-white text-white"
                      : "border-white/20 text-white/60 hover:border-white/50 hover:text-white",
                  ),
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
