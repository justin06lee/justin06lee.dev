import { justifyRows } from "@/components/chrome/salon-layout";

/**
 * Geometry for the hand-arranged projects wall.
 *
 * Pieces are positioned in a fixed "design space" rather than in CSS pixels:
 * the desktop wall is authored against a 1200-unit-wide canvas, the mobile wall
 * against a 390-unit one. At render time the whole wall is scaled by
 * `containerWidth / DESIGN_WIDTH[variant]`, so what was arranged in the editor
 * is exactly what ships at any viewport — only the scale changes, never the
 * composition. The two variants are authored independently because a hang that
 * reads well at 1200 units is not the same hang that reads well at 390.
 *
 * Everything here is pure so the snapping and packing can be tested without a
 * DOM; the editor owns pointer handling and calls into these.
 */

export type WallVariant = "desktop" | "mobile";

export const DESIGN_WIDTH: Record<WallVariant, number> = {
  desktop: 1200,
  mobile: 390,
};

/** A piece's box in design units. */
export type Placement = { x: number; y: number; w: number; h: number };

export type PlacedPiece = Placement & { id: string };

/** A snap line the editor draws while dragging. */
export type Guide = {
  axis: "x" | "y";
  /** Position of the line in design units. */
  at: number;
  /** Whether the line came from a neighbouring piece or from the canvas itself. */
  source: "piece" | "canvas";
};

export type SnapOptions = {
  /** Canvas width in design units. */
  canvasWidth: number;
  /** Max distance (design units) at which a snap engages. */
  threshold?: number;
  /** Grid step in design units; 0 or undefined disables grid snapping. */
  grid?: number;
  /** Whether edge/center alignment to neighbours is active. */
  align?: boolean;
};

const DEFAULT_THRESHOLD = 6;

/* ── placement (de)serialization ────────────────────────────────────────── */

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Parses a stored placement column. Returns null for anything malformed —
 * a bad layout blob should drop the piece back to auto-placement, never break
 * the gallery render.
 */
export function parsePlacement(raw: string | null | undefined): Placement | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const o = parsed as Record<string, unknown>;
    if (!isFiniteNumber(o.x) || !isFiniteNumber(o.y)) return null;
    if (!isFiniteNumber(o.w) || !isFiniteNumber(o.h)) return null;
    if (o.w <= 0 || o.h <= 0) return null;
    return { x: o.x, y: o.y, w: o.w, h: o.h };
  } catch {
    return null;
  }
}

export function serializePlacement(p: Placement | null | undefined): string | null {
  if (!p) return null;
  if (!isFiniteNumber(p.x) || !isFiniteNumber(p.y)) return null;
  if (!isFiniteNumber(p.w) || !isFiniteNumber(p.h) || p.w <= 0 || p.h <= 0) return null;
  // Round to 2dp: sub-pixel precision in design units is noise, and shorter
  // blobs keep the items rows small.
  const r = (n: number) => Math.round(n * 100) / 100;
  return JSON.stringify({ x: r(p.x), y: r(p.y), w: r(p.w), h: r(p.h) });
}

/* ── wall extent ────────────────────────────────────────────────────────── */

/**
 * Total height of a wall in design units — the bottom edge of its lowest piece.
 * Returns 0 for an empty wall so callers can treat "no wall" uniformly.
 */
export function wallHeight(placements: readonly Placement[]): number {
  let max = 0;
  for (const p of placements) {
    const bottom = p.y + p.h;
    if (bottom > max) max = bottom;
  }
  return max;
}

/* ── auto-arrange ───────────────────────────────────────────────────────── */

export type ArrangeInput = { id: string; width: number; height: number };

/**
 * Seeds placements by running the same justified-rows packing the automatic
 * salon uses, then baking the result into absolute design-space boxes. This is
 * the starting point for a hand-arranged wall: let the packer do the first
 * pass, then nudge. Reusing `justifyRows` keeps the seeded layout identical to
 * what the auto wall would have shown.
 */
export function autoArrange(
  items: readonly ArrangeInput[],
  variant: WallVariant,
  opts: { gap?: number; targetRowHeight?: number } = {},
): Record<string, Placement> {
  const canvasWidth = DESIGN_WIDTH[variant];
  const gap = opts.gap ?? (variant === "mobile" ? 8 : 12);
  // The mobile canvas is a third the width, so the desktop target row height
  // would put barely one piece per row; scale the target with the canvas.
  const targetRowHeight =
    opts.targetRowHeight ?? (variant === "mobile" ? 140 : 260);

  const rows = justifyRows([...items], canvasWidth, gap, targetRowHeight);

  const out: Record<string, Placement> = {};
  let y = 0;
  for (const row of rows) {
    let x = 0;
    for (const item of row.items) {
      const w = row.height * (item.width / item.height);
      out[item.id] = { x, y, w, h: row.height };
      x += w + gap;
    }
    y += row.height + gap;
  }
  return out;
}

/**
 * Completes a partially-arranged wall: stored boxes are kept exactly as
 * authored, and anything without one is packed into a block below the existing
 * hang.
 *
 * This is why a newly added project needs no visit to the editor — it simply
 * appears at the bottom of the wall. Both the editor and the public renderer
 * call this, so what you drag is literally what ships; if only the editor
 * seeded, a new project would be invisible on the live site until saved.
 */
export function seedWall(
  pieces: readonly ArrangeInput[],
  stored: Readonly<Record<string, Placement | null | undefined>>,
  variant: WallVariant,
  opts: { gap?: number; targetRowHeight?: number } = {},
): Record<string, Placement> {
  const out: Record<string, Placement> = {};
  const missing: ArrangeInput[] = [];
  for (const piece of pieces) {
    const placement = stored[piece.id];
    if (placement) out[piece.id] = placement;
    else missing.push(piece);
  }
  if (missing.length === 0) return out;

  const gap = opts.gap ?? (variant === "mobile" ? 8 : 12);
  const existingBottom = wallHeight(Object.values(out));
  const offsetY = existingBottom > 0 ? existingBottom + gap : 0;

  for (const [id, placement] of Object.entries(autoArrange(missing, variant, opts))) {
    out[id] = { ...placement, y: placement.y + offsetY };
  }
  return out;
}

/* ── snapping ───────────────────────────────────────────────────────────── */

type Candidate = { at: number; source: "piece" | "canvas" };

/** The three snap lines a box offers on one axis: near edge, center, far edge. */
function axisLines(start: number, size: number): [number, number, number] {
  return [start, start + size / 2, start + size];
}

function collectCandidates(
  others: readonly Placement[],
  canvasWidth: number,
  axis: "x" | "y",
  canvasHeight: number | null,
): Candidate[] {
  const out: Candidate[] = [];
  for (const o of others) {
    const [a, b, c] = axis === "x" ? axisLines(o.x, o.w) : axisLines(o.y, o.h);
    out.push({ at: a, source: "piece" }, { at: b, source: "piece" }, { at: c, source: "piece" });
  }
  if (axis === "x") {
    out.push(
      { at: 0, source: "canvas" },
      { at: canvasWidth / 2, source: "canvas" },
      { at: canvasWidth, source: "canvas" },
    );
  } else {
    // The wall has no fixed bottom, so only the top edge is a meaningful
    // canvas line on Y unless the caller supplies a height.
    out.push({ at: 0, source: "canvas" });
    if (canvasHeight != null) out.push({ at: canvasHeight, source: "canvas" });
  }
  return out;
}

/**
 * Finds the smallest offset that brings any of `anchors` onto a candidate line
 * within `threshold`. Ties resolve to the earliest anchor, which makes the
 * result stable frame to frame instead of flickering between two equal snaps.
 */
function nearestSnap(
  anchors: readonly number[],
  candidates: readonly Candidate[],
  threshold: number,
): { delta: number; guide: Guide["at"]; source: Candidate["source"] } | null {
  let best: { delta: number; guide: number; source: Candidate["source"] } | null = null;
  for (const anchor of anchors) {
    for (const c of candidates) {
      const delta = c.at - anchor;
      if (Math.abs(delta) > threshold) continue;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) {
        best = { delta, guide: c.at, source: c.source };
      }
    }
  }
  return best;
}

function snapToGrid(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

/**
 * Snaps a piece being moved. Alignment to neighbours takes precedence over the
 * grid on each axis independently: lining up with another piece is a more
 * deliberate act than landing on an arbitrary grid step, so when both are in
 * range the alignment wins and the grid only applies where nothing aligned.
 */
export function snapMove(
  rect: Placement,
  others: readonly Placement[],
  opts: SnapOptions,
): { rect: Placement; guides: Guide[] } {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const grid = opts.grid ?? 0;
  const align = opts.align ?? true;
  const guides: Guide[] = [];

  let { x, y } = rect;

  if (align) {
    const xSnap = nearestSnap(
      axisLines(rect.x, rect.w),
      collectCandidates(others, opts.canvasWidth, "x", null),
      threshold,
    );
    if (xSnap) {
      x = rect.x + xSnap.delta;
      guides.push({ axis: "x", at: xSnap.guide, source: xSnap.source });
    }
    const ySnap = nearestSnap(
      axisLines(rect.y, rect.h),
      collectCandidates(others, opts.canvasWidth, "y", null),
      threshold,
    );
    if (ySnap) {
      y = rect.y + ySnap.delta;
      guides.push({ axis: "y", at: ySnap.guide, source: ySnap.source });
    }
  }

  if (grid > 0) {
    if (!guides.some((g) => g.axis === "x")) x = snapToGrid(x, grid);
    if (!guides.some((g) => g.axis === "y")) y = snapToGrid(y, grid);
  }

  return { rect: { ...rect, x, y }, guides };
}

/** Which edges a resize handle drives. */
export type ResizeHandle =
  | "nw" | "n" | "ne"
  | "w"  |        "e"
  | "sw" | "s" | "se";

const HANDLE_EDGES: Record<ResizeHandle, { left: boolean; right: boolean; top: boolean; bottom: boolean }> = {
  nw: { left: true,  right: false, top: true,  bottom: false },
  n:  { left: false, right: false, top: true,  bottom: false },
  ne: { left: false, right: true,  top: true,  bottom: false },
  w:  { left: true,  right: false, top: false, bottom: false },
  e:  { left: false, right: true,  top: false, bottom: false },
  sw: { left: true,  right: false, top: false, bottom: true  },
  s:  { left: false, right: false, top: false, bottom: true  },
  se: { left: false, right: true,  top: false, bottom: true  },
};

export const MIN_PIECE_SIZE = 24;

/**
 * Snaps a piece being resized. Only the edges the handle actually drives are
 * snap anchors — snapping the fixed edge would drag the whole piece while the
 * user is sizing it, which reads as the box escaping the cursor.
 */
export function snapResize(
  rect: Placement,
  handle: ResizeHandle,
  others: readonly Placement[],
  opts: SnapOptions,
): { rect: Placement; guides: Guide[] } {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const grid = opts.grid ?? 0;
  const align = opts.align ?? true;
  const edges = HANDLE_EDGES[handle];
  const guides: Guide[] = [];

  let { x, y, w, h } = rect;

  const applyX = (target: number, which: "left" | "right") => {
    if (which === "left") {
      const right = x + w;
      x = Math.min(target, right - MIN_PIECE_SIZE);
      w = right - x;
    } else {
      w = Math.max(MIN_PIECE_SIZE, target - x);
    }
  };
  const applyY = (target: number, which: "top" | "bottom") => {
    if (which === "top") {
      const bottom = y + h;
      y = Math.min(target, bottom - MIN_PIECE_SIZE);
      h = bottom - y;
    } else {
      h = Math.max(MIN_PIECE_SIZE, target - y);
    }
  };

  if (align) {
    const xCandidates = collectCandidates(others, opts.canvasWidth, "x", null);
    if (edges.left) {
      const s = nearestSnap([x], xCandidates, threshold);
      if (s) { applyX(s.guide, "left"); guides.push({ axis: "x", at: s.guide, source: s.source }); }
    } else if (edges.right) {
      const s = nearestSnap([x + w], xCandidates, threshold);
      if (s) { applyX(s.guide, "right"); guides.push({ axis: "x", at: s.guide, source: s.source }); }
    }

    const yCandidates = collectCandidates(others, opts.canvasWidth, "y", null);
    if (edges.top) {
      const s = nearestSnap([y], yCandidates, threshold);
      if (s) { applyY(s.guide, "top"); guides.push({ axis: "y", at: s.guide, source: s.source }); }
    } else if (edges.bottom) {
      const s = nearestSnap([y + h], yCandidates, threshold);
      if (s) { applyY(s.guide, "bottom"); guides.push({ axis: "y", at: s.guide, source: s.source }); }
    }
  }

  if (grid > 0) {
    const hasX = guides.some((g) => g.axis === "x");
    const hasY = guides.some((g) => g.axis === "y");
    if (!hasX && edges.left) applyX(snapToGrid(x, grid), "left");
    if (!hasX && edges.right) applyX(snapToGrid(x + w, grid), "right");
    if (!hasY && edges.top) applyY(snapToGrid(y, grid), "top");
    if (!hasY && edges.bottom) applyY(snapToGrid(y + h, grid), "bottom");
  }

  return { rect: { x, y, w: Math.max(MIN_PIECE_SIZE, w), h: Math.max(MIN_PIECE_SIZE, h) }, guides };
}

/**
 * Resizes `rect` by moving `handle` to (px, py), optionally locking the
 * original aspect ratio. Aspect lock drives the box from whichever axis the
 * pointer moved further on, so a corner drag tracks the cursor instead of
 * jumping when the two axes disagree.
 */
export function resizeRect(
  rect: Placement,
  handle: ResizeHandle,
  px: number,
  py: number,
  lockAspect: boolean,
): Placement {
  const edges = HANDLE_EDGES[handle];
  const aspect = rect.w / rect.h;

  let { x, y, w, h } = rect;
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;

  if (edges.left) {
    x = Math.min(px, right - MIN_PIECE_SIZE);
    w = right - x;
  } else if (edges.right) {
    w = Math.max(MIN_PIECE_SIZE, px - rect.x);
  }
  if (edges.top) {
    y = Math.min(py, bottom - MIN_PIECE_SIZE);
    h = bottom - y;
  } else if (edges.bottom) {
    h = Math.max(MIN_PIECE_SIZE, py - rect.y);
  }

  if (lockAspect && Number.isFinite(aspect) && aspect > 0) {
    const drivesX = edges.left || edges.right;
    const drivesY = edges.top || edges.bottom;
    if (drivesX && drivesY) {
      // Corner: follow the axis that moved proportionally further.
      if (Math.abs(w / rect.w - 1) >= Math.abs(h / rect.h - 1)) h = w / aspect;
      else w = h * aspect;
    } else if (drivesX) {
      h = w / aspect;
    } else if (drivesY) {
      w = h * aspect;
    }
    // Re-anchor the edges the handle does not drive so the fixed corner stays put.
    if (edges.left) x = right - w;
    if (edges.top) y = bottom - h;
  }

  return { x, y, w: Math.max(MIN_PIECE_SIZE, w), h: Math.max(MIN_PIECE_SIZE, h) };
}

/**
 * Keeps a piece inside the canvas horizontally and below its top edge. There is
 * deliberately no bottom clamp: the wall grows downward as you arrange it.
 */
export function clampToCanvas(rect: Placement, canvasWidth: number): Placement {
  const w = Math.min(rect.w, canvasWidth);
  const x = Math.max(0, Math.min(rect.x, canvasWidth - w));
  return { x, y: Math.max(0, rect.y), w, h: rect.h };
}
