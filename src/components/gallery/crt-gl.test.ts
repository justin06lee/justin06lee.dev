import { describe, expect, it } from "vitest";
import { pictureSpan } from "./crt-gl";

describe("pictureSpan", () => {
  it("shows the whole picture when it is the glass's own aspect", () => {
    expect(pictureSpan(4 / 3, 4 / 3, 0.15, 1)).toEqual([1, 1]);
  });

  it("squashes a wider picture up to the tolerance, then crops the rest", () => {
    // 10% wider than the glass: all squash, no crop.
    const [sx, sy] = pictureSpan(1.1, 1, 0.15, 1);
    expect(sx).toBeCloseTo(1);
    expect(sy).toBe(1);
    // 50% wider: squash 15%, crop the remaining ~23% of the width evenly.
    const [cx, cy] = pictureSpan(1.5, 1, 0.15, 1);
    expect(cx).toBeCloseTo(1.15 / 1.5);
    expect(cy).toBe(1);
  });

  it("does the same on the other axis for a taller picture", () => {
    const [sx, sy] = pictureSpan(1, 1.5, 0.15, 1);
    expect(sx).toBe(1);
    expect(sy).toBeCloseTo(1.15 / 1.5);
  });

  it("never crops with an unbounded stretch", () => {
    expect(pictureSpan(3, 1, Infinity, 1)).toEqual([1, 1]);
  });

  it("overscan samples a smaller window so the raster runs past the glass", () => {
    const [sx, sy] = pictureSpan(1, 1, 0.15, 1.05);
    expect(sx).toBeCloseTo(1 / 1.05);
    expect(sy).toBeCloseTo(1 / 1.05);
  });
});
