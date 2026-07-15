"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/chrome/badge";

export interface TagInputProps {
  /** Current tags (controlled). */
  value: string[];
  /** Called with the next tag list on every add/remove. */
  onChange: (tags: string[]) => void;
  /** Clickable "existing tags" chips; already-present ones are hidden. */
  suggestions?: string[];
  placeholder?: string;
  /** When false, only suggestions can be added — typed text is ignored. */
  allowFreeText?: boolean;
  className?: string;
}

export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "add a tag…",
  allowFreeText = true,
  className,
}: TagInputProps) {
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (value.includes(tag)) return;
    onChange([...value, tag]);
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const commitDraft = () => {
    if (!allowFreeText) return;
    if (draft.trim()) addTag(draft);
    setDraft("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Backspace" && draft === "") {
      const last = value[value.length - 1];
      if (last !== undefined) {
        e.preventDefault();
        removeTag(last);
      }
    }
  };

  const remaining = suggestions.filter((t) => !value.includes(t));

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex flex-wrap items-center gap-1.5 bg-transparent border border-white/20 px-2 py-1.5",
          "text-sm text-white focus-within:border-white/50",
        )}
      >
        {value.map((tag) => (
          <Badge key={tag} variant="outline" className="gap-1">
            {tag}
            <button
              type="button"
              aria-label={`remove ${tag}`}
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="text-white/40 hover:text-white transition-colors"
            >
              ×
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          placeholder={value.length === 0 ? placeholder : ""}
          className={cn(
            "flex-1 min-w-[6rem] bg-transparent px-1 py-0.5 text-sm text-white",
            "placeholder:text-white/30 focus:outline-none",
          )}
        />
      </div>
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {remaining.map((tag) => (
            <Badge key={tag} variant="ghost" onClick={() => addTag(tag)}>
              + {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
