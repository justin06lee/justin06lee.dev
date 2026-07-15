"use client";

import { cn } from "@/lib/utils";

export type PaletteColor = { name: string; hex: string };

/** Muted palette ported from the calendar categories. */
export const CATEGORY_PALETTE: readonly PaletteColor[] = [
  { name: "slate-blue", hex: "#5b7a8a" },
  { name: "taupe", hex: "#7a6b5b" },
  { name: "sage", hex: "#6b8a72" },
  { name: "plum", hex: "#7a5b78" },
  { name: "ochre", hex: "#8a7a5b" },
  { name: "terracotta", hex: "#8a6655" },
  { name: "fog", hex: "#7a8085" },
  { name: "indigo", hex: "#5b5b8a" },
] as const;

/**
 * Returns the palette hex used least often in `used`. Ties broken by earlier
 * palette position. If `used` is empty, returns the first color.
 */
export function pickNextUnusedColor(used: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const c of CATEGORY_PALETTE) counts.set(c.hex, 0);
  for (const h of used) {
    if (counts.has(h)) counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  let bestHex = CATEGORY_PALETTE[0]!.hex;
  let bestCount = Infinity;
  for (const c of CATEGORY_PALETTE) {
    const n = counts.get(c.hex) ?? 0;
    if (n < bestCount) {
      bestCount = n;
      bestHex = c.hex;
    }
  }
  return bestHex;
}

export type ColorSwatchProps = {
  /** Hex color rendered as the chip fill. */
  color: string;
  className?: string;
  title?: string;
};

/** A tiny presentational color chip. */
export function ColorSwatch({ color, className, title }: ColorSwatchProps) {
  return (
    <span
      className={cn("inline-block size-3 border border-white/30", className)}
      style={{ backgroundColor: color }}
      title={title}
    />
  );
}

export type ColorSwatchPickerProps = {
  /** Currently selected hex, or null when nothing is chosen. */
  value: string | null;
  onChange: (hex: string) => void;
  /** Palette to choose from. Defaults to CATEGORY_PALETTE. */
  palette?: readonly PaletteColor[];
  className?: string;
  ariaLabel?: string;
};

/** A fixed-palette picker: a row of swatches, one selectable at a time. */
export function ColorSwatchPicker({
  value,
  onChange,
  palette = CATEGORY_PALETTE,
  className,
  ariaLabel,
}: ColorSwatchPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel ?? "color"}
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {palette.map((c) => {
        const active = c.hex === value;
        return (
          <button
            key={c.hex}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={c.name}
            title={c.name}
            onClick={() => onChange(c.hex)}
            className={cn(
              "inline-block size-5 border p-0",
              active
                ? "border-white"
                : "border-white/20 hover:border-white/50",
            )}
            style={{ backgroundColor: c.hex }}
          />
        );
      })}
    </div>
  );
}
