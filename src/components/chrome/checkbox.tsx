import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  /** Optional label rendered to the right of the box. */
  label?: React.ReactNode;
  /** Extra classes for the outer <label> wrapper. */
  wrapperClassName?: string;
}

/**
 * Square checkbox with a check-on-fill. Wraps a native `<input type="checkbox">`
 * (so `name`/`checked`/`onChange`/`required` work in forms) with the box visually
 * replaced: thin translucent border, no corners, fills white with a black check
 * when checked. Dark-only. `className` targets the box; pass a `label` for the
 * text beside it.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, wrapperClassName, label, disabled, ...props }, ref) => (
    <label
      className={cn(
        "group inline-flex select-none items-center gap-2 text-sm text-white/80",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        wrapperClassName,
      )}
    >
      <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
        <input
          ref={ref}
          type="checkbox"
          disabled={disabled}
          className={cn(
            "peer size-4 cursor-[inherit] appearance-none border border-white/20 bg-transparent",
            "transition-colors checked:border-white checked:bg-white",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50",
            className,
          )}
          {...props}
        />
        <Check
          aria-hidden
          className="pointer-events-none absolute size-3 stroke-[3] text-black opacity-0 peer-checked:opacity-100"
        />
      </span>
      {label != null && <span>{label}</span>}
    </label>
  ),
);
Checkbox.displayName = "Checkbox";
