import { describe, it, expect } from "vitest";
import {
  DESIGN_WIDTH,
  MIN_PIECE_SIZE,
  autoArrange,
  clampToCanvas,
  parsePlacement,
  resizeRect,
  seedWall,
  serializePlacement,
  snapMove,
  snapResize,
  wallHeight,
  type Placement,
} from "./gallery-wall";

const rect = (x: number, y: number, w: number, h: number): Placement => ({ x, y, w, h });

describe("parsePlacement / serializePlacement", () => {
  it("round-trips a valid placement", () => {
    const p = rect(10, 20, 300, 200);
    expect(parsePlacement(serializePlacement(p))).toEqual(p);
  });

  it("rounds to 2dp on serialize so stored blobs stay small", () => {
    expect(serializePlacement(rect(1.23456, 2.5, 3.9999, 4))).toBe(
      '{"x":1.23,"y":2.5,"w":4,"h":4}',
    );
  });

  it("returns null for malformed, empty, or non-object input", () => {
    expect(parsePlacement(null)).toBeNull();
    expect(parsePlacement("")).toBeNull();
    expect(parsePlacement("not json")).toBeNull();
    expect(parsePlacement("[1,2,3]")).toBeNull();
    expect(parsePlacement('"a string"')).toBeNull();
  });

  it("rejects placements with missing, non-finite, or non-positive fields", () => {
    expect(parsePlacement('{"x":0,"y":0,"w":10}')).toBeNull();
    expect(parsePlacement('{"x":null,"y":0,"w":10,"h":10}')).toBeNull();
    expect(parsePlacement('{"x":0,"y":0,"w":0,"h":10}')).toBeNull();
    expect(parsePlacement('{"x":0,"y":0,"w":-5,"h":10}')).toBeNull();
  });

  it("serializes null for absent or degenerate placements", () => {
    expect(serializePlacement(null)).toBeNull();
    expect(serializePlacement(rect(0, 0, 0, 10))).toBeNull();
    expect(serializePlacement({ x: NaN, y: 0, w: 1, h: 1 })).toBeNull();
  });
});

describe("wallHeight", () => {
  it("is the bottom edge of the lowest piece", () => {
    expect(wallHeight([rect(0, 0, 100, 100), rect(0, 250, 100, 90)])).toBe(340);
  });

  it("is 0 for an empty wall", () => {
    expect(wallHeight([])).toBe(0);
  });
});

describe("autoArrange", () => {
  const items = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, width: 100, height: 100 }));

  it("places every item and keeps them inside the design canvas", () => {
    const out = autoArrange(items, "desktop");
    expect(Object.keys(out)).toHaveLength(6);
    for (const p of Object.values(out)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(DESIGN_WIDTH.desktop + 0.01);
    }
  });

  it("preserves each item's aspect ratio", () => {
    const mixed = [
      { id: "wide", width: 300, height: 100 },
      { id: "tall", width: 100, height: 300 },
    ];
    const out = autoArrange(mixed, "desktop");
    expect(out.wide.w / out.wide.h).toBeCloseTo(3);
    expect(out.tall.w / out.tall.h).toBeCloseTo(1 / 3);
  });

  it("stacks rows downward without overlapping vertically", () => {
    const out = autoArrange(items, "desktop");
    const sorted = Object.values(out).sort((a, b) => a.y - b.y);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      // Same row (equal y) or strictly below the previous row's bottom.
      expect(cur.y === prev.y || cur.y >= prev.y + prev.h).toBe(true);
    }
  });

  it("uses a smaller target row height on mobile so a row isn't one piece", () => {
    const out = autoArrange(items, "mobile");
    for (const p of Object.values(out)) {
      expect(p.x + p.w).toBeLessThanOrEqual(DESIGN_WIDTH.mobile + 0.01);
    }
    // 390 units at a 140 target fits more than one square per row.
    const topRow = Object.values(out).filter((p) => p.y === 0);
    expect(topRow.length).toBeGreaterThan(1);
  });

  it("returns an empty map for no items", () => {
    expect(autoArrange([], "desktop")).toEqual({});
  });
});

describe("seedWall", () => {
  const pieces = [
    { id: "a", width: 100, height: 100 },
    { id: "b", width: 100, height: 100 },
  ];

  it("keeps stored placements exactly as authored", () => {
    const stored = { a: rect(11, 22, 333, 244) };
    const out = seedWall(pieces, stored, "desktop");
    expect(out.a).toEqual(rect(11, 22, 333, 244));
  });

  it("places an unplaced piece below the existing hang", () => {
    const stored = { a: rect(0, 0, 300, 200) };
    const out = seedWall(pieces, stored, "desktop");
    expect(out.b).toBeDefined();
    expect(out.b.y).toBeGreaterThanOrEqual(200);
  });

  it("arranges from the top when nothing is placed yet", () => {
    const out = seedWall(pieces, {}, "desktop");
    expect(Math.min(...Object.values(out).map((p) => p.y))).toBe(0);
  });

  it("returns a placement for every piece", () => {
    const out = seedWall(pieces, { a: rect(0, 0, 100, 100) }, "desktop");
    expect(Object.keys(out).sort()).toEqual(["a", "b"]);
  });

  it("ignores stored entries that are null or undefined", () => {
    const out = seedWall(pieces, { a: null, b: undefined }, "desktop");
    expect(Object.keys(out).sort()).toEqual(["a", "b"]);
    expect(Math.min(...Object.values(out).map((p) => p.y))).toBe(0);
  });

  it("drops stored placements for pieces that no longer exist", () => {
    const out = seedWall(pieces, { a: rect(0, 0, 100, 100), gone: rect(0, 0, 50, 50) }, "desktop");
    expect(out.gone).toBeUndefined();
  });
});

describe("snapMove", () => {
  const opts = { canvasWidth: 1000, threshold: 6, align: true };

  it("snaps a left edge onto a neighbour's left edge", () => {
    const others = [rect(100, 0, 200, 100)];
    const { rect: out, guides } = snapMove(rect(103, 300, 150, 100), others, opts);
    expect(out.x).toBe(100);
    expect(guides).toContainEqual({ axis: "x", at: 100, source: "piece" });
  });

  it("snaps a right edge onto a neighbour's left edge (abutting)", () => {
    const others = [rect(400, 0, 200, 100)];
    const { rect: out } = snapMove(rect(248, 0, 150, 100), others, opts);
    expect(out.x + out.w).toBe(400);
  });

  it("snaps centers together", () => {
    const others = [rect(100, 0, 200, 100)]; // center x = 200
    const { rect: out } = snapMove(rect(122, 300, 150, 100), others, opts); // center 197
    expect(out.x + out.w / 2).toBe(200);
  });

  it("snaps to the canvas center and edges", () => {
    const { rect: out, guides } = snapMove(rect(423, 0, 150, 100), [], opts); // center 498
    expect(out.x + out.w / 2).toBe(500);
    expect(guides).toContainEqual({ axis: "x", at: 500, source: "canvas" });
  });

  it("does not snap beyond the threshold", () => {
    const others = [rect(100, 0, 200, 100)]; // x lines 100 / 200 / 300
    // Anchors 140 / 215 / 290 clear every piece and canvas line by > 6.
    const moved = rect(140, 300, 150, 100);
    const { rect: out, guides } = snapMove(moved, others, opts);
    expect(out).toEqual(moved);
    expect(guides).toHaveLength(0);
  });

  it("prefers the nearest candidate when several are in range", () => {
    const others = [rect(100, 0, 50, 100), rect(104, 0, 50, 100)];
    const { rect: out } = snapMove(rect(103, 300, 60, 100), others, opts);
    expect(out.x).toBe(104);
  });

  it("snaps both axes independently in one move", () => {
    const others = [rect(100, 200, 80, 80)];
    const { rect: out, guides } = snapMove(rect(97, 203, 60, 60), others, opts);
    expect(out.x).toBe(100);
    expect(out.y).toBe(200);
    expect(guides).toHaveLength(2);
  });

  it("falls back to the grid on an axis where nothing aligned", () => {
    const others = [rect(100, 0, 200, 100)];
    // x aligns to the neighbour; y has no neighbour line in range, so it grids.
    const { rect: out } = snapMove(rect(103, 307, 150, 100), others, { ...opts, grid: 10 });
    expect(out.x).toBe(100);
    expect(out.y).toBe(310);
  });

  it("lets alignment win over the grid on the same axis", () => {
    const others = [rect(103, 0, 200, 100)];
    const { rect: out } = snapMove(rect(101, 500, 150, 100), others, { ...opts, grid: 10 });
    // Grid alone would pull x to 100; the neighbour edge at 103 takes precedence.
    expect(out.x).toBe(103);
  });

  it("applies the grid with alignment disabled", () => {
    const { rect: out, guides } = snapMove(
      rect(103, 307, 150, 100),
      [rect(100, 0, 200, 100)],
      { ...opts, align: false, grid: 10 },
    );
    expect(out.x).toBe(100);
    expect(out.y).toBe(310);
    expect(guides).toHaveLength(0);
  });
});

describe("snapResize", () => {
  const opts = { canvasWidth: 1000, threshold: 6, align: true };

  it("snaps only the edge the handle drives, leaving the opposite edge fixed", () => {
    const others = [rect(400, 0, 100, 100)];
    const { rect: out } = snapResize(rect(100, 0, 297, 100), "e", others, opts);
    expect(out.x).toBe(100); // left edge untouched
    expect(out.x + out.w).toBe(400); // right edge snapped
  });

  it("moves the origin when a west handle snaps", () => {
    const others = [rect(50, 0, 100, 100)];
    const { rect: out } = snapResize(rect(53, 0, 200, 100), "w", others, opts);
    expect(out.x).toBe(50);
    expect(out.x + out.w).toBe(253); // right edge held
  });

  it("snaps both axes from a corner handle", () => {
    const others = [rect(400, 300, 100, 100)];
    const { rect: out } = snapResize(rect(100, 100, 297, 197), "se", others, opts);
    expect(out.x + out.w).toBe(400);
    expect(out.y + out.h).toBe(300);
  });

  it("never resizes below the minimum piece size", () => {
    const { rect: out } = snapResize(rect(100, 0, MIN_PIECE_SIZE, 100), "w", [], {
      ...opts,
      grid: 1000,
    });
    expect(out.w).toBeGreaterThanOrEqual(MIN_PIECE_SIZE);
    expect(out.h).toBeGreaterThanOrEqual(MIN_PIECE_SIZE);
  });

  it("grids the driven edge when nothing aligns", () => {
    const { rect: out } = snapResize(rect(100, 0, 197, 100), "e", [], { ...opts, grid: 10 });
    expect(out.x + out.w).toBe(300);
  });
});

describe("resizeRect", () => {
  it("moves only the driven edge when unlocked", () => {
    const out = resizeRect(rect(100, 100, 200, 100), "e", 400, 0, false);
    expect(out).toEqual(rect(100, 100, 300, 100));
  });

  it("holds the opposite corner when dragging a west handle", () => {
    const out = resizeRect(rect(100, 100, 200, 100), "w", 50, 0, false);
    expect(out.x).toBe(50);
    expect(out.x + out.w).toBe(300);
  });

  it("preserves aspect from an edge handle when locked", () => {
    const out = resizeRect(rect(0, 0, 200, 100), "e", 400, 0, true);
    expect(out.w).toBe(400);
    expect(out.h).toBe(200); // aspect 2 held
  });

  it("preserves aspect and the fixed corner from a corner handle", () => {
    const start = rect(100, 100, 200, 100); // aspect 2, bottom-right at (300,200)
    const out = resizeRect(start, "nw", 0, 0, true);
    expect(out.w / out.h).toBeCloseTo(2);
    expect(out.x + out.w).toBeCloseTo(300);
    expect(out.y + out.h).toBeCloseTo(200);
  });

  it("clamps to the minimum size instead of inverting the box", () => {
    const out = resizeRect(rect(100, 100, 200, 100), "e", 10, 0, false);
    expect(out.w).toBe(MIN_PIECE_SIZE);
    const west = resizeRect(rect(100, 100, 200, 100), "w", 999, 0, false);
    expect(west.w).toBeGreaterThanOrEqual(MIN_PIECE_SIZE);
  });
});

describe("clampToCanvas", () => {
  it("keeps a piece inside the horizontal bounds", () => {
    expect(clampToCanvas(rect(-50, 10, 200, 100), 1000)).toEqual(rect(0, 10, 200, 100));
    expect(clampToCanvas(rect(950, 10, 200, 100), 1000)).toEqual(rect(800, 10, 200, 100));
  });

  it("shrinks a piece wider than the canvas to fit", () => {
    const out = clampToCanvas(rect(0, 0, 1400, 100), 1000);
    expect(out.w).toBe(1000);
    expect(out.x).toBe(0);
  });

  it("clamps above the top edge but lets the wall grow downward", () => {
    expect(clampToCanvas(rect(0, -20, 100, 100), 1000).y).toBe(0);
    expect(clampToCanvas(rect(0, 9999, 100, 100), 1000).y).toBe(9999);
  });
});
