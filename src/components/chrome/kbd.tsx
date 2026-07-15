import * as React from "react";
import { cn } from "@/lib/utils";

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  /** Keycap size. Default "sm". */
  size?: "sm" | "md";
}

/**
 * A macos-style keycap: mono glyph on a faint raised cap with a heavier
 * bottom edge. Compose combos by placing several side by side, e.g.
 * `<Kbd>⌘</Kbd><Kbd>k</Kbd>`.
 */
export function Kbd({ size = "sm", className, children, ...rest }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex select-none items-center justify-center rounded-[3px]",
        "border border-b-2 border-white/20 bg-white/[0.06] font-mono text-white/75",
        size === "sm" ? "h-5 min-w-5 px-1 text-[11px]" : "h-6 min-w-6 px-1.5 text-xs",
        className,
      )}
      {...rest}
    >
      {children}
    </kbd>
  );
}
