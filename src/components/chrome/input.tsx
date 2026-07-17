import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** CSS background applied to the root element. Transparent by default. */
  background?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, background, style, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "bg-transparent border border-white/20 px-3 py-1.5 text-sm text-white",
        "placeholder:text-white/30 focus:outline-none focus:border-white/50",
        "disabled:opacity-50",
        className,
      )}
      style={{ ...style, background }}
      {...props}
    />
  ),
);
Input.displayName = "Input";
