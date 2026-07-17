import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** CSS background applied to the element. Transparent by default. */
  background?: string;
}

/** Minimal multiline input. Matches Input — thin border, square corners. */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, background, style, rows = 4, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "w-full resize-y bg-transparent border border-white/20 px-3 py-2 text-sm text-white",
        "placeholder:text-white/30 focus:outline-none focus:border-white/50",
        "disabled:opacity-50",
        className,
      )}
      style={{ ...style, background }}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
