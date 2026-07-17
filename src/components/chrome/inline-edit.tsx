"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useInlineEdit } from "@/hooks/use-inline-edit";

export type InlineEditProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "defaultValue"
> & {
  /** Controlled value — the source of truth, owned by the caller. */
  value: string;
  /**
   * Commit the next value (onBlur / Enter). Throw to roll back to `value`.
   * Sync or async; the field is disabled while it runs.
   */
  onCommit: (next: string) => void | Promise<void>;
  /** Trim before commit. Default true. */
  trim?: boolean;
  className?: string;
};

/**
 * Blur-to-save editable field, styled to match the input primitive. Holds a
 * local draft, commits on blur and Enter, disables itself while committing,
 * and rolls back to the previous value on error. Escape cancels.
 */
export function InlineEdit({
  value,
  onCommit,
  trim = true,
  className,
  disabled,
  ...props
}: InlineEditProps) {
  const edit = useInlineEdit({ value, onCommit, trim });

  return (
    <input
      {...props}
      value={edit.draft}
      disabled={disabled || edit.pending}
      onChange={(e) => edit.setDraft(e.target.value)}
      onBlur={(e) => {
        void edit.commit();
        props.onBlur?.(e);
      }}
      onKeyDown={(e) => {
        edit.onKeyDown(e);
        props.onKeyDown?.(e);
      }}
      className={cn(
        "w-full bg-transparent border-b border-transparent px-0 py-1 text-sm text-white",
        "outline-none transition-colors hover:border-white/20 focus:border-white/50",
        "placeholder:text-white/30 disabled:opacity-50",
        className,
      )}
    />
  );
}
