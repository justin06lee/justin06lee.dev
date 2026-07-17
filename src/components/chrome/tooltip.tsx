import { cn } from "@/lib/utils";

export type TooltipSide = "top" | "bottom";

export type TooltipProps = {
  /** Text shown in the pill. */
  label: React.ReactNode;
  side?: TooltipSide;
  className?: string;
  children: React.ReactNode;
};

/**
 * White slide-up pill shown on hover or keyboard focus. Pure CSS — wraps any
 * trigger (`group`), reveals on `group-hover` / `group-focus-within`. The pill
 * is aria-hidden; give the trigger its own accessible label.
 *
 * Transform is written as one arbitrary value (not composed translate-x/y
 * utilities) so the slide transitions smoothly instead of snapping — Tailwind's
 * separate translate vars aren't @property-registered.
 */
export function Tooltip({ label, side = "top", className, children }: TooltipProps) {
  const sideClass =
    side === "top"
      ? "bottom-full [transform:translate(-50%,4px)] group-hover:[transform:translate(-50%,-4px)] group-focus-within:[transform:translate(-50%,-4px)]"
      : "top-full [transform:translate(-50%,-4px)] group-hover:[transform:translate(-50%,4px)] group-focus-within:[transform:translate(-50%,4px)]";

  return (
    <span className={cn("group relative inline-flex", className)}>
      {children}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-1/2 z-10 whitespace-nowrap bg-white px-2 py-1 text-[11px] text-black opacity-0 transition-[opacity,transform] duration-150 group-hover:opacity-100 group-focus-within:opacity-100",
          sideClass,
        )}
      >
        {label}
      </span>
    </span>
  );
}
