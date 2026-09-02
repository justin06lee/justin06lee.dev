import { describe, expect, it } from "vitest";
import { animationPeriod, frameCount, pictureSpan, shiftAnimations, svgSize } from "./crt-gl";

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

describe("svgSize", () => {
  it("prefers width and height, in plain units", () => {
    expect(svgSize('<svg width="64" height="32px" viewBox="0 0 1 1">')).toEqual({ width: 64, height: 32 });
  });

  it("falls back to the viewBox when the size is missing or in other units", () => {
    expect(svgSize('<svg xmlns="x" viewBox="0 0 630 350">')).toEqual({ width: 630, height: 350 });
    expect(svgSize("<svg width='100%' viewBox='0,0,10,5'>")).toEqual({ width: 10, height: 5 });
  });

  it("gives up on a document with neither", () => {
    expect(svgSize("<svg><rect/></svg>")).toBeNull();
    expect(svgSize("not svg")).toBeNull();
  });
});

const BOB = `<svg viewBox="0 0 630 350"><style>
  @media (prefers-reduced-motion: no-preference) {
    .lt { animation: bob 2.8s ease-in-out infinite }
    .l0 { animation-delay: 0.00s }
    .l1 { animation-delay: -0.93s }
    @keyframes bob { 0%, 100% { transform: translateY(-5px) } 50% { transform: translateY(5px) } }
  }
</style><g class="lt l0"/><g class="lt l1"/></svg>`;

describe("animationPeriod", () => {
  it("reads the duration out of a shorthand", () => {
    expect(animationPeriod(BOB)).toBeCloseTo(2.8);
  });

  it("reads longhands, milliseconds, and SMIL dur", () => {
    expect(animationPeriod("<svg><style>.a{animation-duration: 1500ms}</style></svg>")).toBeCloseTo(1.5);
    expect(animationPeriod('<svg><circle><animate attributeName="r" dur="2s" repeatCount="indefinite"/></circle></svg>')).toBe(2);
  });

  it("loops several lengths together at their least common multiple", () => {
    expect(animationPeriod("<svg><style>.a{animation: x 2s infinite} .b{animation: y 3s infinite}</style></svg>")).toBe(6);
  });

  it("settles for the longest when the common loop is impractical", () => {
    expect(animationPeriod("<svg><style>.a{animation: x 7s infinite} .b{animation: y 5s infinite}</style></svg>")).toBe(7);
  });

  it("is 0 for a still", () => {
    expect(animationPeriod('<svg viewBox="0 0 1 1"><rect/></svg>')).toBe(0);
    // animation-delay alone is not an animation.
    expect(animationPeriod("<svg><style>.a{animation-delay: 1s}</style></svg>")).toBe(0);
  });
});

describe("shiftAnimations", () => {
  it("moves every delay back by the offset and gives a delay-less shorthand one", () => {
    const out = shiftAnimations(BOB, 0.7);
    expect(out).toContain("animation: bob 2.8s -0.7s ease-in-out infinite");
    expect(out).toContain("animation-delay: -0.7s");
    expect(out).toContain("animation-delay: -1.63s");
    // The keyframes and the duration are untouched.
    expect(out).toContain("@keyframes bob");
    expect(out).not.toContain("2.1s");
  });

  it("leaves a shorthand's existing delay in place, shifted", () => {
    expect(shiftAnimations("<style>.a{animation: x 2s 1s linear}</style>", 0.5)).toContain("animation: x 2s 0.5s linear");
  });

  it("does not mistake a timing function's numbers for times", () => {
    const out = shiftAnimations("<style>.a{animation: x 2s cubic-bezier(0.1, 0.7, 1, 0.1) infinite, y 1s}</style>", 0.25);
    expect(out).toContain("animation: x 2s -0.25s cubic-bezier(0.1, 0.7, 1, 0.1) infinite, y 1s -0.25s");
  });

  it("shifts SMIL begins, adds one where there is none, and leaves event begins alone", () => {
    const out = shiftAnimations(
      '<svg><animate attributeName="r" begin="1s" dur="2s"/><animate attributeName="x" dur="1s"/><set attributeName="y" begin="click"/></svg>',
      0.4,
    );
    expect(out).toContain('begin="0.6s"');
    expect(out).toContain('<animate attributeName="x" dur="1s" begin="-0.4s"/>');
    expect(out).toContain('begin="click"');
  });

  it("is the identity at zero", () => {
    expect(shiftAnimations(BOB, 0)).toBe(BOB);
  });
});

describe("frameCount", () => {
  it("samples ten a second within bounds", () => {
    expect(frameCount(2.8)).toBe(28);
    expect(frameCount(0.2)).toBe(6);
    expect(frameCount(9)).toBe(30);
  });
});
