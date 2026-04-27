import { describe, it, expect } from "vitest";
import { CATEGORY_PALETTE, isPaletteColor, pickNextUnusedColor } from "./colors";

describe("CATEGORY_PALETTE", () => {
  it("has 8 muted entries with name + hex", () => {
    expect(CATEGORY_PALETTE).toHaveLength(8);
    for (const c of CATEGORY_PALETTE) {
      expect(c.name).toMatch(/^[a-z-]+$/);
      expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("isPaletteColor", () => {
  it("accepts a known palette hex", () => {
    expect(isPaletteColor(CATEGORY_PALETTE[0].hex)).toBe(true);
  });
  it("rejects unknown hexes", () => {
    expect(isPaletteColor("#ff0000")).toBe(false);
    expect(isPaletteColor("not-a-hex")).toBe(false);
  });
});

describe("pickNextUnusedColor", () => {
  it("returns the first palette color when none are used", () => {
    expect(pickNextUnusedColor([])).toBe(CATEGORY_PALETTE[0].hex);
  });
  it("skips used colors and returns the first unused one", () => {
    const used = [CATEGORY_PALETTE[0].hex, CATEGORY_PALETTE[1].hex];
    expect(pickNextUnusedColor(used)).toBe(CATEGORY_PALETTE[2].hex);
  });
  it("wraps to least-used (earliest in palette wins ties) when all are taken", () => {
    const used = CATEGORY_PALETTE.map((c) => c.hex);
    used.push(CATEGORY_PALETTE[3].hex); // index 3 used twice; all others once
    // All non-3 entries tie at count 1; tie broken by earliest palette position → index 0.
    expect(pickNextUnusedColor(used)).toBe(CATEGORY_PALETTE[0].hex);
  });
});
