import { cn } from "@/lib/utils";

export type BadgeVariant = "outline" | "solid" | "ghost";

export type BadgeProps = {
  variant?: BadgeVariant;
  /** When set, renders as a toggle button (e.g. a filter chip). */
  onClick?: () => void;
  /** Toggle state for the ghost/filter use case — drives the active styling. */
  active?: boolean;
  className?: string;
  children?: React.ReactNode;
};

const variantClass: Record<BadgeVariant, string> = {
  // Tech tag: thin border, muted text.
  outline: "border border-white/15 text-white/80",
  // Selected / emphasis chip.
  solid: "bg-white text-black",
  // Filter chip: transparent until hovered.
  ghost: "text-white/60 hover:bg-white/10 hover:text-white",
};

/**
 * Small chip. Static label by default; pass `onClick` to make it a toggle
 * (filter) button, with `active` swapping to the solid look.
 */
export function Badge({
  variant = "outline",
  onClick,
  active = false,
  className,
  children,
}: BadgeProps) {
  const cls = cn(
    "inline-flex items-center px-2 py-0.5 text-xs transition-colors",
    active ? variantClass.solid : variantClass[variant],
    className,
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={cls}>
        {children}
      </button>
    );
  }
  return <span className={cls}>{children}</span>;
}
