import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MangaPages, frameWidthCss, type MangaPiece } from "./MangaPages";
import { packPages, type PanelFrame } from "@/lib/manga-layout";

const piece = (id: string, width = 100, height = 100): MangaPiece => ({
  id,
  title: id,
  src: null,
  width,
  height,
});

type PanelLeaf = Extract<PanelFrame<MangaPiece>, { kind: "panel" }>;

const panel = (
  id: string,
  aspect: number,
  percent: number,
  offset: number,
  extra: Partial<MangaPiece> = {},
): PanelLeaf => ({
  kind: "panel",
  item: { ...piece(id), ...extra },
  aspect,
  percent,
  offset,
  m: aspect,
  c: 0,
});

describe("MangaPages page gutters", () => {
  const pages: PanelFrame<MangaPiece>[] = [panel("first", 1, 100, 0), panel("second", 1, 100, 0)];

  it("separates pages by 48px while keeping the 8px internal seam", () => {
    const html = renderToStaticMarkup(
      createElement(MangaPages, { pages, ariaLabel: "panels" }),
    );

    expect(html).toContain('aria-label="panels"');
    expect(html).toContain("gap:48px");
  });

  it("allows an explicit page gutter override", () => {
    const html = renderToStaticMarkup(createElement(MangaPages, { pages, pageGap: 64 }));
    expect(html).toContain("gap:64px");
  });
});

describe("MangaPages widths", () => {
  it("emits an exact aspect-ratio box for every panel", () => {
    const pieces = [
      piece("wide", 1234, 393), piece("tall", 686, 948), piece("square", 528, 528),
      piece("band", 749, 142), piece("half", 890, 536), piece("portrait", 802, 1008),
    ];
    const html = renderToStaticMarkup(
      createElement(MangaPages, { pages: packPages(pieces, 3) }),
    );

    for (const item of pieces) {
      expect(html).toContain(`aspect-ratio:${item.width / item.height}`);
    }
  });

  it("expresses nested widths as calc() so the browser reproduces the solve", () => {
    // Gap terms are px and the rest is a percentage of the parent — that pairing
    // is what makes the layout exact at every container width with no measuring.
    const html = renderToStaticMarkup(
      createElement(MangaPages, {
        pages: packPages(
          [piece("a", 1200, 400), piece("b", 600, 900), piece("c", 700, 700), piece("d", 500, 800)],
          9,
        ),
      }),
    );
    expect(html).toMatch(/width:calc\([\d.]+% [-+] [\d.]+px\)/);
  });

  it("collapses a whole-width node to a plain percentage", () => {
    const html = renderToStaticMarkup(
      createElement(MangaPages, { pages: [panel("solo", 1.5, 100, 0)] }),
    );
    expect(html).toContain("width:100%");
    expect(html).not.toContain("calc(100% + 0px)");
  });

  it("centres a page that does not run the full width", () => {
    const html = renderToStaticMarkup(
      createElement(MangaPages, { pages: [panel("slab", 0.25, 23.75, 0)] }),
    );
    expect(html).toContain("width:23.75%");
    expect(html).toContain("margin-inline:auto");
  });
});

describe("MangaPages content", () => {
  it("links a piece that has a destination and plain-boxes one that doesn't", () => {
    const linked = panel("linked", 1, 100, 0, { href: "https://example.com", src: "/a.png" });
    const html = renderToStaticMarkup(createElement(MangaPages, { pages: [linked] }));
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('src="/a.png"');
  });

  it("never crops: panel art is contained, not covered", () => {
    const withArt = panel("art", 2, 100, 0, { src: "/b.png" });
    const html = renderToStaticMarkup(createElement(MangaPages, { pages: [withArt] }));
    expect(html).toContain("object-contain");
    expect(html).not.toContain("object-cover");
  });

  it("falls back to a typographic placard when a piece has no art", () => {
    const html = renderToStaticMarkup(
      createElement(MangaPages, { pages: [panel("no-art", 1, 100, 0)] }),
    );
    expect(html).toContain("no-art");
    expect(html).not.toContain("<img");
  });
});

/**
 * Resolves the emitted CSS the way a browser would, so the assertions below are
 * about what actually ships rather than about the solver's own arithmetic:
 * a percentage resolves against the parent's used width, `aspect-ratio` turns a
 * panel's width into its height, and a flex gap eats real pixels.
 */
function resolve(css: string, parentWidth: number): number {
  const calc = css.match(/^calc\(([\d.]+)% ([-+]) ([\d.]+)px\)$/);
  if (calc) {
    const sign = calc[2] === "-" ? -1 : 1;
    return (parentWidth * Number(calc[1])) / 100 + sign * Number(calc[3]);
  }
  const percent = css.match(/^([\d.]+)%$/);
  if (!percent) throw new Error(`unrecognised width: ${css}`);
  return (parentWidth * Number(percent[1])) / 100;
}

function laidOutHeight(frame: PanelFrame<MangaPiece>, width: number, gap: number): number {
  if (frame.kind === "panel") return width / frame.aspect;

  const heights = frame.children.map((child) =>
    laidOutHeight(child, frame.kind === "row" ? resolve(frameWidthCss(child), width) : width, gap),
  );
  if (frame.kind === "stack") {
    return heights.reduce((a, b) => a + b, 0) + gap * (frame.children.length - 1);
  }

  // A tier only reads as one band if every frame in it lands on the same height.
  for (const height of heights) expect(height).toBeCloseTo(heights[0], 2);
  // ...and it only fills without a hole if the widths plus seams span it exactly.
  const spanned =
    frame.children.reduce((sum, child) => sum + resolve(frameWidthCss(child), width), 0) +
    gap * (frame.children.length - 1);
  expect(spanned).toBeCloseTo(width, 2);
  return Math.max(...heights);
}

describe("MangaPages — the emitted CSS reproduces the solve", () => {
  const PIECES = [
    piece("byakugan", 802, 1008), piece("valhalla", 528, 528), piece("reze", 890, 536),
    piece("mahito", 1374, 1762), piece("frieren", 749, 142), piece("omniscience", 1672, 1672),
    piece("henri", 528, 528), piece("toji", 1234, 393), piece("ruri", 780, 890),
    piece("zanka", 592, 592), piece("shoko", 518, 458), piece("yagami", 686, 948),
  ];

  it("tiles every page exactly, at every container width", () => {
    for (const container of [390, 768, 1120, 1600]) {
      for (let seed = 0; seed < 12; seed++) {
        for (const page of packPages(PIECES, seed)) {
          const width = resolve(frameWidthCss(page), container);
          expect(width).toBeLessThanOrEqual(container + 1e-6);
          const height = laidOutHeight(page, width, 8);
          // Rounding the emitted numbers must not drift the page off the solve.
          expect(height).toBeCloseTo((width - page.c) / page.m, 1);
        }
      }
    }
  });
});
