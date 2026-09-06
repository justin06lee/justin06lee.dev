/**
 * Manga page layout for the projects gallery.
 *
 * The material is already-composed manga panels — someone framed each one — so
 * the hard constraint is that a panel's box must end up at *exactly* its
 * image's aspect ratio. Any layout that picks a slot's shape first and fits the
 * art to it crops; an early fixed-template version made `reze` give up 47% of
 * itself. Nothing here may reintroduce that.
 *
 * Justified rows satisfy the constraint but only express one manga idea (the
 * tier), so a wall built from them reads as an arbitrary brick wall rather than
 * a page. Real pages are *recursive*: a page is a stack of tiers, a tier is a
 * run of frames side by side, and a frame is sometimes itself a short column of
 * stacked panels. That vocabulary — and only that — is what `pageShapes`
 * enumerates.
 *
 * The trick that makes recursion compatible with "never crop" is that every
 * node's width is an exact affine function of its height:
 *
 *     w = m * h + c            (c is in px, and only ever carries gap terms)
 *
 *   - panel:  w = aspect * h                    → m = aspect,      c = 0
 *   - row:    heights are shared, widths add    → m = Σmᵢ,         c = Σcᵢ + g(n-1)
 *   - stack:  widths are shared, heights add    → m = 1/Σ(1/mᵢ),   c = (Σ(cᵢ/mᵢ) - g(n-1)) / Σ(1/mᵢ)
 *
 * Solving that top-down from the container width gives every panel a box of its
 * own aspect with no cropping *and* no dead space, at any width. What varies to
 * absorb the images is the page's height — which is the intended trade: a page
 * is as tall as its panels require, rather than the panels being as tall as the
 * page allows.
 *
 * A horizontal band inverts which dimension is given: every page shares the
 * band's height and it is the *width* that varies. The geometry is untouched —
 * one affine family, and fixing either end fixes the other — but scoring has to
 * follow, or `minPanelSize` is measured at a size the page will never be drawn
 * at. That is what `referenceHeight` is for.
 *
 * Because the relation is affine, each child's width is also affine in the
 * parent's width, so the whole layout emits as `calc(P% + Qpx)` per node and
 * the browser reproduces it exactly. No measurement, no client JS, no reflow.
 */

/**
 * The height the gallery hangs its band at, twice over: the number the packer
 * scores against and the CSS length the browser draws. One definition, because
 * the two have to agree — the pack picks page structures for panels of a given
 * size, and a browser drawing them at some other size makes that choice a lie.
 *
 * Below ~1000px of viewport the svh term wins and the whole band draws smaller
 * than the figure scoring used. That is the same slack the layout already lives
 * with down the page, where `minPanelSize` is a share of `referenceWidth` and a
 * narrow window shrinks every panel together.
 */
export const STRIP_HEIGHT = 780;
export const STRIP_HEIGHT_CSS = `min(78svh, ${STRIP_HEIGHT}px)`;

export type Sized = { width: number; height: number };

/**
 * A solved node. `percent`/`offset` express this node's width as
 * `calc(percent% + offset px)` of its parent's content box; `m`/`c` carry the
 * affine relation above so a caller can derive the node's height as
 * `(width - c) / m`.
 */
export type PanelFrame<T> = {
  percent: number;
  offset: number;
  m: number;
  c: number;
} & (
  | { kind: "panel"; item: T; aspect: number }
  | { kind: "row"; children: PanelFrame<T>[] }
  | { kind: "stack"; children: PanelFrame<T>[] }
);

/* ── randomness ─────────────────────────────────────────────────────────── */

/**
 * mulberry32 — small, fast, well-distributed. Seeded rather than `Math.random`
 * so a layout can be reproduced: the gallery passes a fresh seed per request
 * (that is the per-reload re-deal), but `?seed=N` pins one for comparison.
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates, out of place. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ── the page grammar ───────────────────────────────────────────────────── */

/** A template: page structure with panel-shaped holes, before any art. */
type Shape =
  | { kind: "panel" }
  | { kind: "row"; children: Shape[] }
  | { kind: "stack"; children: Shape[] };

const PANEL: Shape = { kind: "panel" };

/** Panels in one page. Six is already a busy page; beyond it nothing reads. */
export const MAX_PAGE_PANELS = 6;
/** Frames across one tier. Four is rare in print and scored down, not banned. */
const MAX_TIER_FRAMES = 4;
/** Panels in a column nested inside a tier — the "two stacked beside a tall". */
const MAX_COLUMN_PANELS = 3;
/** Tiers on a page. Four is the dense end of a standard page. */
const MAX_TIERS = 4;
/** Panels in one tier. */
const MAX_TIER_PANELS = 4;

/** Every ordered way to write `total` as `parts` addends, each in [lo, hi]. */
function compositions(total: number, parts: number, lo: number, hi: number): number[][] {
  if (parts === 0) return total === 0 ? [[]] : [];
  const out: number[][] = [];
  const max = Math.min(hi, total - lo * (parts - 1));
  for (let v = lo; v <= max; v++) {
    for (const rest of compositions(total - v, parts - 1, lo, hi)) out.push([v, ...rest]);
  }
  return out;
}

/** One frame inside a tier: a panel, or a short column of stacked panels. */
function frameShape(panels: number): Shape {
  if (panels === 1) return PANEL;
  return { kind: "stack", children: Array.from({ length: panels }, () => PANEL) };
}

/** One tier of a page: a full-width panel, or a run of frames across. */
function tierShapes(panels: number): Shape[] {
  if (panels === 1) return [PANEL];
  const out: Shape[] = [];
  for (let frames = 2; frames <= MAX_TIER_FRAMES; frames++) {
    for (const split of compositions(panels, frames, 1, MAX_COLUMN_PANELS)) {
      out.push({ kind: "row", children: split.map(frameShape) });
    }
  }
  return out;
}

const pageShapeCache = new Map<number, Shape[]>();

/**
 * Every page structure this module will consider for `panels` pieces.
 *
 * The grammar is deliberately narrow — stack of tiers, tier of frames, frame of
 * stacked panels, and no deeper. That is the vocabulary of a printed page, and
 * excluding everything else is what keeps the wall from drifting back into
 * arbitrary rectangles. A single tier is included because a full-width band is
 * a legitimate page too; it is just scored down so it does not become the
 * default.
 */
function pageShapes(panels: number): Shape[] {
  if (panels <= 0) return [];
  const cached = pageShapeCache.get(panels);
  if (cached) return cached;

  const out: Shape[] = panels === 1 ? [PANEL] : tierShapes(panels).filter((s) => s.kind !== "panel");
  for (let tiers = 2; tiers <= MAX_TIERS; tiers++) {
    for (const split of compositions(panels, tiers, 1, MAX_TIER_PANELS)) {
      // Cartesian product across the tiers: every tier shape combines with
      // every other, which is where the page-to-page variety comes from.
      let combos: Shape[][] = [[]];
      for (const count of split) {
        const next: Shape[][] = [];
        for (const prefix of combos) for (const tier of tierShapes(count)) next.push([...prefix, tier]);
        combos = next;
      }
      for (const children of combos) out.push({ kind: "stack", children });
    }
  }

  pageShapeCache.set(panels, out);
  return out;
}

/* ── solving ────────────────────────────────────────────────────────────── */

type Seed<T> = { item: T; aspect: number };

type Solved<T> = { m: number; c: number } & (
  | { kind: "panel"; item: T; aspect: number }
  | { kind: "row"; children: Solved<T>[] }
  | { kind: "stack"; children: Solved<T>[] }
);

const aspectOf = (s: Sized) => (s.width > 0 && s.height > 0 ? s.width / s.height : 1);

/** Fills a template's holes from `queue` in order and solves `m`/`c` bottom-up. */
function build<T>(shape: Shape, queue: Seed<T>[], cursor: { at: number }, gap: number): Solved<T> {
  if (shape.kind === "panel") {
    const seed = queue[cursor.at++];
    return { kind: "panel", item: seed.item, aspect: seed.aspect, m: seed.aspect, c: 0 };
  }

  const children = shape.children.map((child) => build(child, queue, cursor, gap));
  const gaps = gap * (children.length - 1);

  if (shape.kind === "row") {
    let m = 0;
    let c = gaps;
    for (const child of children) {
      m += child.m;
      c += child.c;
    }
    return { kind: "row", children, m, c };
  }

  let inverse = 0;
  let weighted = 0;
  for (const child of children) {
    inverse += 1 / child.m;
    weighted += child.c / child.m;
  }
  return { kind: "stack", children, m: 1 / inverse, c: (weighted - gaps) / inverse };
}

/** Panel boxes in px, for scoring. Rows share a height; stacks share a width. */
function collectBoxes<T>(node: Solved<T>, width: number, out: { w: number; h: number }[]): void {
  const height = (width - node.c) / node.m;
  if (node.kind === "panel") {
    out.push({ w: width, h: height });
    return;
  }
  if (node.kind === "row") {
    for (const child of node.children) collectBoxes(child, child.m * height + child.c, out);
    return;
  }
  for (const child of node.children) collectBoxes(child, width, out);
}

/** Turns a solved tree into per-node `calc(percent% + offset px)` widths. */
function toFrame<T>(node: Solved<T>, percent: number, offset: number): PanelFrame<T> {
  const base = { percent, offset, m: node.m, c: node.c };
  if (node.kind === "panel") {
    return { ...base, kind: "panel", item: node.item, aspect: node.aspect };
  }
  if (node.kind === "stack") {
    // Stacked panels all span the column, so their width is the parent's.
    return { ...base, kind: "stack", children: node.children.map((c) => toFrame(c, 100, 0)) };
  }
  // A row child's width is mᵢ·h + cᵢ where h = (W - C)/M, which rearranges to
  // (mᵢ/M)·W + (cᵢ - mᵢ·C/M) — affine in the row's own width, hence a calc().
  return {
    ...base,
    kind: "row",
    children: node.children.map((child) =>
      toFrame(child, (child.m / node.m) * 100, child.c - (child.m * node.c) / node.m),
    ),
  };
}

/* ── choosing a page ────────────────────────────────────────────────────── */

export type PackOptions = {
  /** Seam between panels, in px. */
  gap?: number;
  /** Width the scoring reasons about, in px. Geometry itself is width-free. */
  referenceWidth?: number;
  /**
   * Height the pages will be drawn at, in px. Set this when the wall hangs as
   * a horizontal band, where the height is what every page shares and the
   * *width* is what varies to absorb the images — the mirror of a page down
   * the screen. Scoring then measures panels at the size they will really be
   * drawn, so `minPanelSize` is a true floor rather than a share of
   * `referenceWidth`; without it a dense page, squeezed to the band height,
   * quietly lands 27% under the floor the packer thought it had cleared.
   */
  referenceHeight?: number;
  /** Page height bounds, as a fraction of the container width. */
  minPageHeight?: number;
  maxPageHeight?: number;
  /**
   * Shortest edge a panel may have before it reads as a sliver, at
   * `referenceWidth`. A share of the page rather than a real pixel count: the
   * layout scales whole, so a panel that is a sliver here is a sliver on every
   * screen.
   */
  minPanelSize?: number;
  /** Panels per page, drawn from this weighted bag. */
  pageRhythm?: number[];
};

const DEFAULTS = {
  gap: 8,
  // max-w-6xl (1152px) less the page's px-4 gutters.
  referenceWidth: 1120,
  minPageHeight: 0.42,
  maxPageHeight: 0.95,
  minPanelSize: 200,
  pageRhythm: [3, 3, 4, 4, 4, 5, 5, 6],
};

/** Assignments to try per template. Small n is exhaustive; larger n is sampled. */
const ASSIGNMENT_CAP = 48;

type Scoring = Required<
  Pick<PackOptions, "referenceWidth" | "minPageHeight" | "maxPageHeight" | "minPanelSize">
> &
  Pick<PackOptions, "referenceHeight">;

/**
 * How page-like a solved page is. Lower is better; `Infinity` rejects.
 *
 * The two terms that matter are hard-won: a page outside the height band either
 * scrolls forever or reads as a strip, and a panel below `minPanelSize` is a
 * sliver that the art inside it can't survive — a floor in reference px, which
 * the affine solve turns into a fixed share of the page at every container
 * width. Everything after them is taste —
 * notably a nudge toward one dominant frame, because a page where every panel
 * is the same size is exactly the flat look this replaced.
 */
function scorePage<T>(root: Solved<T>, opts: Scoring, target: number, jitter: number): number {
  // A page is one affine family, so fixing either dimension fixes the other:
  // down the page the container's width is the constant, across a band it is
  // the height. `fraction` below is the page's own aspect either way, so the
  // band terms need no second form.
  const strip = opts.referenceHeight !== undefined;
  const height = strip ? opts.referenceHeight! : (opts.referenceWidth - root.c) / root.m;
  const width = strip ? root.m * height + root.c : opts.referenceWidth;
  if (!Number.isFinite(height) || height <= 0) return Infinity;
  if (!Number.isFinite(width) || width <= 0) return Infinity;

  const boxes: { w: number; h: number }[] = [];
  collectBoxes(root, width, boxes);

  let cost = jitter;

  const fraction = height / width;
  if (fraction < opts.minPageHeight) cost += (opts.minPageHeight - fraction) * 40;
  if (fraction > opts.maxPageHeight) cost += (fraction - opts.maxPageHeight) * 40;
  // Inside the band there is still a drawn target, so consecutive pages differ
  // in height. Without it the search drifts to whichever end of the band the
  // other terms happen to favour, and every page comes out the same size.
  cost += Math.abs(fraction - target) * 1.5;

  let totalArea = 0;
  let largestArea = 0;
  for (const box of boxes) {
    if (!Number.isFinite(box.w) || !Number.isFinite(box.h) || box.w <= 0 || box.h <= 0) {
      return Infinity;
    }
    const shortest = Math.min(box.w, box.h);
    if (shortest < opts.minPanelSize) {
      // Squared and heavily weighted, because this is a hard term competing
      // against taste terms worth tenths: a linear nudge let a ~130px sidecar
      // ride along next to a full-width band, which is the shape this is here
      // to stop. Squaring keeps a panel that lands just under the floor cheap
      // while making a true sliver unaffordable, and leaving it finite means
      // the least-bad page still wins when a strip-shaped image makes the
      // floor unreachable in every candidate.
      const deficit = (opts.minPanelSize - shortest) / opts.minPanelSize;
      cost += deficit * deficit * 120;
    }
    const area = box.w * box.h;
    totalArea += area;
    if (area > largestArea) largestArea = area;
  }

  // A printed page has a focal frame roughly twice the average. Weak, so it
  // only breaks ties between layouts that are already geometrically sound.
  if (boxes.length > 1) {
    cost += Math.abs(largestArea / (totalArea / boxes.length) - 2.2) * 0.3;
  }
  // One tier of plain side-by-side panels is exactly the justified row this
  // replaced — the shape that made the wall read as arbitrary rectangles. A row
  // that contains a stacked column is not that, and is not penalised.
  if (boxes.length > 2 && isFlatTier(root)) cost += 0.6;
  // A page is canonically read as a sequence of tiers. A single tier split into
  // columns is a real page too, just not the one to reach for by default.
  if (root.kind === "row") cost += 0.2;
  cost += countWideTiers(root) * 0.15;

  return cost;
}

/** A single tier of bare panels — no stacking anywhere. */
function isFlatTier<T>(node: Solved<T>): boolean {
  return node.kind === "row" && node.children.every((child) => child.kind === "panel");
}

/** Tiers of four frames — legal, but uncommon enough in print to discourage. */
function countWideTiers<T>(node: Solved<T>): number {
  if (node.kind === "panel") return 0;
  const self = node.kind === "row" && node.children.length >= 4 ? 1 : 0;
  return node.children.reduce((sum, child) => sum + countWideTiers(child), self);
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) out.push([items[i], ...tail]);
  }
  return out;
}

/**
 * Which panel lands in which hole. Node geometry is invariant to the order of a
 * node's children, so many permutations are equivalent — exhaustive search only
 * pays off while it is cheap, and past that a seeded sample finds the same
 * quality without the cost.
 */
function assignments<T>(panels: Seed<T>[], rng: () => number): Seed<T>[][] {
  if (panels.length <= 4) return permutations(panels);
  const out = [panels.slice()];
  for (let i = 1; i < ASSIGNMENT_CAP; i++) out.push(shuffle(panels, rng));
  return out;
}

/** Best-scoring structure + assignment for one page's worth of panels. */
function layoutPage<T>(panels: Seed<T>[], gap: number, opts: Scoring, rng: () => number): PanelFrame<T> {
  const shapes = pageShapes(panels.length);
  // Everything the RNG is used for is drawn up front and in a fixed order:
  // exploring candidates must not consume it in a search-order-dependent way,
  // or the seed stops reproducing the page.
  const target = opts.minPageHeight + rng() * (opts.maxPageHeight - opts.minPageHeight);
  const tries = assignments(panels, rng);
  const jitter = shapes.map(() => rng() * 0.08);

  let best: Solved<T> | null = null;
  let bestCost = Infinity;
  for (let s = 0; s < shapes.length; s++) {
    for (const order of tries) {
      const solved = build(shapes[s], order, { at: 0 }, gap);
      const cost = scorePage(solved, opts, target, jitter[s]);
      if (cost < bestCost) {
        bestCost = cost;
        best = solved;
      }
    }
  }

  // Unreachable for any real input — every panel count has at least one shape —
  // but a single full-width tier is the honest fallback if one ever appears.
  const root = best ?? build({ kind: "row", children: panels.map(() => PANEL) }, panels, { at: 0 }, gap);

  // A lone panel is the one case with no neighbouring art to absorb its height,
  // so it is the one case that gets narrowed instead of run to full width. In a
  // band the height is already fixed, so a lone panel simply comes out narrow
  // and there is nothing to correct.
  const height = (opts.referenceWidth - root.c) / root.m;
  if (opts.referenceHeight === undefined && root.kind === "panel" && height > opts.maxPageHeight * opts.referenceWidth) {
    return toFrame(root, opts.maxPageHeight * root.aspect * 100, 0);
  }
  return toFrame(root, 100, 0);
}

/**
 * Splits the wall into pages and lays each one out.
 *
 * Page size is drawn from a weighted rhythm rather than fixed, so the wall does
 * not fall into a visible period. The only correction is that a page may never
 * be left with a single panel when others were available — a stranded panel has
 * to run full width, which is the one shape this layout cannot make read.
 */
export function packPages<T extends Sized>(
  items: readonly T[],
  seed: number,
  options: PackOptions = {},
): PanelFrame<T>[] {
  if (items.length === 0) return [];

  const gap = options.gap ?? DEFAULTS.gap;
  const rhythm = options.pageRhythm ?? DEFAULTS.pageRhythm;
  const scoring: Scoring = {
    referenceWidth: options.referenceWidth ?? DEFAULTS.referenceWidth,
    referenceHeight: options.referenceHeight,
    minPageHeight: options.minPageHeight ?? DEFAULTS.minPageHeight,
    maxPageHeight: options.maxPageHeight ?? DEFAULTS.maxPageHeight,
    minPanelSize: options.minPanelSize ?? DEFAULTS.minPanelSize,
  };

  const rng = makeRng(seed);
  const queue: Seed<T>[] = shuffle(items, rng).map((item) => ({ item, aspect: aspectOf(item) }));

  const pages: PanelFrame<T>[] = [];
  let cursor = 0;
  while (cursor < queue.length) {
    const remaining = queue.length - cursor;
    let take = rhythm[Math.floor(rng() * rhythm.length)] ?? 4;
    take = Math.max(2, Math.min(MAX_PAGE_PANELS, take));
    if (remaining <= MAX_PAGE_PANELS) take = remaining;
    else if (remaining - take < 2) take = remaining - 2;

    pages.push(layoutPage(queue.slice(cursor, cursor + take), gap, scoring, rng));
    cursor += take;
  }

  return pages;
}

/* ── inspection ─────────────────────────────────────────────────────────── */

/** Every panel on a page, in reading order. */
export function panelsOf<T>(frame: PanelFrame<T>): Extract<PanelFrame<T>, { kind: "panel" }>[] {
  if (frame.kind === "panel") return [frame];
  return frame.children.flatMap(panelsOf);
}

/**
 * Laid-out panel boxes at a given container width, in px.
 *
 * The renderer never calls this — the browser derives the same boxes from the
 * emitted CSS. It exists so the layout's claims (nothing crops, nothing
 * overlaps, nothing overflows) can be checked as geometry rather than trusted.
 */
export function measurePage<T>(
  frame: PanelFrame<T>,
  containerWidth: number,
  gap: number = DEFAULTS.gap,
): { item: T; x: number; y: number; w: number; h: number }[] {
  const out: { item: T; x: number; y: number; w: number; h: number }[] = [];

  const walk = (node: PanelFrame<T>, x: number, y: number, width: number) => {
    const height = (width - node.c) / node.m;
    if (node.kind === "panel") {
      out.push({ item: node.item, x, y, w: width, h: height });
      return;
    }
    if (node.kind === "row") {
      let at = x;
      for (const child of node.children) {
        // Frames in a tier share the tier's height; their widths follow from it.
        const childWidth = child.m * height + child.c;
        walk(child, at, y, childWidth);
        at += childWidth + gap;
      }
      return;
    }
    let at = y;
    for (const child of node.children) {
      // Panels in a column share the column's width; their heights follow.
      walk(child, x, at, width);
      at += (width - child.c) / child.m + gap;
    }
  };

  walk(frame, 0, 0, (containerWidth * frame.percent) / 100 + frame.offset);
  return out;
}
