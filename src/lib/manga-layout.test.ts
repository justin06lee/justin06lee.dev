import { describe, it, expect } from "vitest";
import {
  MAX_PAGE_PANELS,
  makeRng,
  measurePage,
  packPages,
  panelsOf,
  shuffle,
  STRIP_HEIGHT,
  type PanelFrame,
} from "./manga-layout";

const item = (w: number, h: number, id = "") => ({ width: w, height: h, id });

/** The real gallery's shapes, measured from the live repos. */
const REAL = [
  item(802, 1008, "byakugan"), item(528, 528, "valhalla"), item(890, 536, "reze"),
  item(1374, 1762, "mahito"), item(749, 142, "frieren"), item(1672, 1672, "omniscience"),
  item(528, 528, "henri"), item(1234, 393, "toji"), item(780, 890, "ruri"),
  item(592, 592, "zanka"), item(518, 458, "shoko"), item(686, 948, "yagami"),
];

const WIDTH = 1120;
const GAP = 8;

const allPanels = <T,>(pages: PanelFrame<T>[]) => pages.flatMap(panelsOf);

describe("makeRng / shuffle", () => {
  it("is deterministic for a given seed", () => {
    expect(Array.from({ length: 8 }, makeRng(42))).toEqual(
      Array.from({ length: 8 }, makeRng(42)),
    );
  });

  it("produces different streams for different seeds", () => {
    expect(Array.from({ length: 8 }, makeRng(1))).not.toEqual(
      Array.from({ length: 8 }, makeRng(2)),
    );
  });

  it("stays in [0,1)", () => {
    const rng = makeRng(7);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("permutes without losing or duplicating items", () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    expect(shuffle(input, makeRng(3)).sort((a, b) => a - b)).toEqual(input);
  });

  it("does not mutate its input", () => {
    const input = [1, 2, 3, 4, 5];
    shuffle(input, makeRng(9));
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("packPages — never crops", () => {
  it("gives every panel a box of its own exact aspect ratio", () => {
    // The property the whole module exists for. Everything else is taste.
    for (let seed = 0; seed < 25; seed++) {
      for (const panel of allPanels(packPages(REAL, seed))) {
        expect(panel.aspect).toBeCloseTo(panel.item.width / panel.item.height, 10);
      }
    }
  });

  it("lays every panel out at that aspect, at any container width", () => {
    for (const width of [360, 768, 1120, 1600]) {
      for (let seed = 0; seed < 12; seed++) {
        for (const page of packPages(REAL, seed)) {
          for (const box of measurePage(page, width)) {
            expect(box.w / box.h).toBeCloseTo(box.item.width / box.item.height, 6);
          }
        }
      }
    }
  });

  it("places every item exactly once", () => {
    for (let seed = 0; seed < 25; seed++) {
      const ids = allPanels(packPages(REAL, seed)).map((p) => p.item.id);
      expect(ids.slice().sort()).toEqual(REAL.map((i) => i.id).sort());
    }
  });
});

describe("packPages — tiles its page exactly", () => {
  /** Rows fill their parent's width; stacks fill its height. No gaps, no overflow. */
  const checkNode = (node: PanelFrame<{ id: string }>, width: number) => {
    const height = (width - node.c) / node.m;
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    if (node.kind === "panel") {
      expect(width / height).toBeCloseTo(node.aspect, 6);
      return;
    }
    if (node.kind === "row") {
      let spanned = GAP * (node.children.length - 1);
      for (const child of node.children) {
        const childWidth = child.m * height + child.c;
        // Every frame in a tier lands on the tier's height — that is what makes
        // the tier fill exactly, and it is what a fixed-slot template can't do.
        expect((childWidth - child.c) / child.m).toBeCloseTo(height, 6);
        spanned += childWidth;
        checkNode(child, childWidth);
      }
      expect(spanned).toBeCloseTo(width, 6);
      return;
    }
    let stacked = GAP * (node.children.length - 1);
    for (const child of node.children) {
      stacked += (width - child.c) / child.m;
      checkNode(child, width);
    }
    expect(stacked).toBeCloseTo(height, 6);
  };

  it("fills every node with no dead space and no overflow", () => {
    for (let seed = 0; seed < 25; seed++) {
      for (const page of packPages(REAL, seed)) {
        checkNode(page, (WIDTH * page.percent) / 100 + page.offset);
      }
    }
  });

  it("never overflows the container, at any width", () => {
    for (const width of [360, 768, 1120, 1600]) {
      for (let seed = 0; seed < 12; seed++) {
        for (const page of packPages(REAL, seed)) {
          for (const box of measurePage(page, width)) {
            expect(box.x).toBeGreaterThanOrEqual(-1e-6);
            expect(box.x + box.w).toBeLessThanOrEqual(width + 1e-6);
          }
        }
      }
    }
  });

  it("never overlaps two panels", () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const page of packPages(REAL, seed)) {
        const boxes = measurePage(page, WIDTH);
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i];
            const b = boxes[j];
            const overlaps =
              a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 &&
              a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
            expect(overlaps, `${a.item.id} overlaps ${b.item.id} (seed ${seed})`).toBe(false);
          }
        }
      }
    }
  });
});

describe("packPages — reads as a page", () => {
  it("almost never falls back to one flat tier of panels", () => {
    // The failure this replaced: every page a single justified row, which is
    // why the wall read as arbitrary rectangles rather than as pages.
    let flat = 0;
    let total = 0;
    for (let seed = 0; seed < 30; seed++) {
      for (const page of packPages(REAL, seed)) {
        total++;
        const panels = panelsOf(page).length;
        if (panels > 2 && page.kind === "row" && page.children.every((c) => c.kind === "panel")) {
          flat++;
        }
      }
    }
    expect(flat / total).toBeLessThan(0.1);
  });

  it("builds nested columns inside tiers, not just bands", () => {
    const nested = (node: PanelFrame<{ id: string }>): boolean =>
      node.kind === "row"
        ? node.children.some((c) => c.kind === "stack" || nested(c))
        : node.kind === "stack" && node.children.some(nested);
    expect(
      Array.from({ length: 40 }, (_, seed) => packPages(REAL, seed).some(nested)).filter(Boolean)
        .length,
    ).toBeGreaterThan(4);
  });

  it("keeps pages inside a readable height band", () => {
    for (let seed = 0; seed < 30; seed++) {
      for (const page of packPages(REAL, seed)) {
        const width = (WIDTH * page.percent) / 100 + page.offset;
        const height = (width - page.c) / page.m;
        expect(height / WIDTH, `seed ${seed}`).toBeLessThan(1.15);
      }
    }
  });

  it("does not produce sliver panels", () => {
    for (let seed = 0; seed < 60; seed++) {
      for (const page of packPages(REAL, seed)) {
        for (const box of measurePage(page, WIDTH)) {
          expect(Math.min(box.w, box.h), `${box.item.id} at seed ${seed}`).toBeGreaterThan(130);
        }
      }
    }
  });

  it("keeps nearly every panel at or above the minimum edge", () => {
    // The floor is a strong preference rather than a guarantee: a 5:1 strip
    // sharing a tier can put it out of reach of every candidate, and the
    // search then takes the least-bad page. The guarantee is that this stays
    // rare — before the floor bit, a ~130px sidecar next to a full-width band
    // was routine.
    const edges: number[] = [];
    for (let seed = 0; seed < 60; seed++) {
      for (const page of packPages(REAL, seed)) {
        for (const box of measurePage(page, WIDTH)) edges.push(Math.min(box.w, box.h));
      }
    }
    const short = edges.filter((edge) => edge < 180).length;
    expect(short / edges.length).toBeLessThan(0.05);
  });

  it("holds the minimum as a share of the page, not as pixels", () => {
    // A panel keeps its share of the page at any width — only the fixed 8px
    // seams don't scale, so the share drifts by a few percent and no more.
    // That invariance is what makes a px floor at the reference width the
    // right thing to reason about for a phone as well as a desktop.
    const share = (box: { w: number; h: number }, width: number) => Math.min(box.w, box.h) / width;
    for (let seed = 0; seed < 20; seed++) {
      for (const page of packPages(REAL, seed)) {
        const wide = measurePage(page, WIDTH);
        const narrow = measurePage(page, 390);
        for (let i = 0; i < wide.length; i++) {
          const drift = Math.abs(share(narrow[i], 390) - share(wide[i], WIDTH)) / share(wide[i], WIDTH);
          expect(drift, `${wide[i].item.id} at seed ${seed}`).toBeLessThan(0.08);
        }
      }
    }
  });

  it("varies panel size within a page — a page has a focal frame", () => {
    const spreads: number[] = [];
    for (let seed = 0; seed < 20; seed++) {
      for (const page of packPages(REAL, seed)) {
        const areas = measurePage(page, WIDTH).map((b) => b.w * b.h);
        if (areas.length > 1) spreads.push(Math.max(...areas) / Math.min(...areas));
      }
    }
    const median = spreads.sort((a, b) => a - b)[Math.floor(spreads.length / 2)];
    expect(median).toBeGreaterThan(1.8);
  });

  it("never strands a single panel on a page when others were available", () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const page of packPages(REAL, seed)) {
        expect(panelsOf(page).length).toBeGreaterThan(1);
      }
    }
  });

  it("keeps pages within the panel budget", () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const page of packPages(REAL, seed)) {
        expect(panelsOf(page).length).toBeLessThanOrEqual(MAX_PAGE_PANELS);
      }
    }
  });
});

describe("packPages — re-deals", () => {
  it("is deterministic for a given seed", () => {
    expect(JSON.stringify(packPages(REAL, 77))).toBe(JSON.stringify(packPages(REAL, 77)));
  });

  it("differs across seeds", () => {
    expect(JSON.stringify(packPages(REAL, 1))).not.toBe(JSON.stringify(packPages(REAL, 2)));
  });

  it("moves a given project around so a new one isn't stuck at the bottom", () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      packPages(REAL, seed).forEach((page, index) => {
        if (panelsOf(page).some((p) => p.item.id === "toji")) seen.add(index);
      });
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("packPages — edges", () => {
  it("returns nothing for an empty input", () => {
    expect(packPages([], 1)).toEqual([]);
  });

  it("handles a single item", () => {
    const pages = packPages([item(1600, 900, "solo")], 1);
    expect(pages).toHaveLength(1);
    expect(panelsOf(pages[0]).map((p) => p.item.id)).toEqual(["solo"]);
  });

  it("narrows a lone tall panel instead of running it full width", () => {
    // Nothing beside it can absorb its height, so this is the one case that
    // gives up width rather than growing into a full-screen slab.
    const [page] = packPages([item(500, 2000, "slab")], 1);
    expect(page.percent).toBeLessThan(100);
    const width = (WIDTH * page.percent) / 100;
    expect((width - page.c) / page.m).toBeLessThanOrEqual(WIDTH * 0.95 + 1e-6);
  });

  it("handles a two-piece wall", () => {
    for (let seed = 0; seed < 10; seed++) {
      const pages = packPages([item(800, 600, "a"), item(600, 800, "b")], seed);
      expect(allPanels(pages).map((p) => p.item.id).sort()).toEqual(["a", "b"]);
    }
  });

  it("does not divide by zero on a degenerate size", () => {
    const pages = packPages([item(0, 0, "bad"), item(100, 100, "ok"), item(200, 100, "fine")], 1);
    const boxes = pages.flatMap((page) => measurePage(page, WIDTH));
    expect(boxes.map((b) => b.item.id).sort()).toEqual(["bad", "fine", "ok"]);
    for (const box of boxes) {
      expect(Number.isFinite(box.w)).toBe(true);
      expect(Number.isFinite(box.h)).toBe(true);
    }
  });

  it("lays out a large wall without stalling", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      item(400 + ((i * 137) % 900), 300 + ((i * 89) % 700), `p${i}`),
    );
    const started = Date.now();
    const pages = packPages(many, 4);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(allPanels(pages)).toHaveLength(60);
  });
});

describe("packPages — as a band", () => {
  const H = STRIP_HEIGHT;
  /** Every page in a band is drawn at the band's height, so its width follows. */
  const bandWidth = (page: PanelFrame<{ id: string }>) => page.m * H + page.c;

  it("gives every page exactly the band's height", () => {
    // The whole point of the band: the pages differ in width, never in height,
    // so the hang is one page tall however many projects there are.
    for (let seed = 0; seed < 20; seed++) {
      for (const page of packPages(REAL, seed, { referenceHeight: H })) {
        const boxes = measurePage(page, bandWidth(page), GAP);
        const bottom = Math.max(...boxes.map((b) => b.y + b.h));
        expect(bottom, `seed ${seed}`).toBeCloseTo(H, 6);
      }
    }
  });

  it("still lands every panel on its own aspect", () => {
    // Fixing the height instead of the width must not cost the one hard
    // constraint: the art is composed, so a panel's box is its image's shape.
    for (let seed = 0; seed < 20; seed++) {
      for (const page of packPages(REAL, seed, { referenceHeight: H })) {
        for (const box of measurePage(page, bandWidth(page), GAP)) {
          const source = REAL.find((r) => r.id === box.item.id)!;
          expect(box.w / box.h, `${box.item.id} @ seed ${seed}`).toBeCloseTo(
            source.width / source.height,
            4,
          );
        }
      }
    }
  });

  it("holds the panel floor at the size the band actually draws", () => {
    // The reason `referenceHeight` exists. Scored against the 1120px page and
    // then squeezed to the band, a dense page lands well under the floor the
    // packer thought it had cleared; scored against the band, it doesn't.
    let worstScoredAsPage = Infinity;
    let worstScoredAsBand = Infinity;
    for (let seed = 0; seed < 20; seed++) {
      for (const page of packPages(REAL, seed)) {
        for (const b of measurePage(page, bandWidth(page), GAP)) {
          worstScoredAsPage = Math.min(worstScoredAsPage, b.w, b.h);
        }
      }
      for (const page of packPages(REAL, seed, { referenceHeight: H })) {
        for (const b of measurePage(page, bandWidth(page), GAP)) {
          worstScoredAsBand = Math.min(worstScoredAsBand, b.w, b.h);
        }
      }
    }
    expect(worstScoredAsBand).toBeGreaterThan(worstScoredAsPage);
    expect(worstScoredAsBand).toBeGreaterThan(140);
  });

  it("leaves a lone tall panel narrow rather than narrowing the page", () => {
    // Down the page a lone slab is capped by shrinking its box. In a band the
    // height is already the cap, so the correction would only shrink it twice.
    const [page] = packPages([item(500, 2000, "slab")], 1, { referenceHeight: H });
    expect(page.percent).toBe(100);
    expect(bandWidth(page)).toBeCloseTo(H * (500 / 2000), 6);
  });

  it("keeps the band's page widths inside the same aspect band as a page", () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const page of packPages(REAL, seed, { referenceHeight: H })) {
        const aspect = bandWidth(page) / H;
        expect(aspect, `seed ${seed}`).toBeGreaterThan(0.9);
        expect(aspect, `seed ${seed}`).toBeLessThan(3);
      }
    }
  });
});
