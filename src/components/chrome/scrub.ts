export type Edge = "left" | "right";

/**
 * Map a relative x position (0 = left, 1 = right) to a frame index.
 * The FULL width maps to the frame range — edge zones never clamp this,
 * they only feed sweep detection (see stepEdge).
 */
export function relXToFrame(relX: number, frames: number, reverse: boolean): number {
  const clamped = Math.min(1, Math.max(0, relX));
  const t = reverse ? 1 - clamped : clamped;
  return Math.round(t * (frames - 1));
}

/**
 * Advance the edge tracker for one pointer sample. Returns the next tracked
 * edge plus, when the pointer reached one edge zone after last visiting the
 * opposite one (i.e. a full sweep completed), the edge that completed it.
 * Re-entering the same zone never re-fires.
 */
export function stepEdge(
  last: Edge | null,
  relX: number,
  edgeLeft: number,
  edgeRight: number,
): { last: Edge | null; swept: Edge | null } {
  if (relX <= edgeLeft) {
    return { last: "left", swept: last === "right" ? "left" : null };
  }
  if (relX >= edgeRight) {
    return { last: "right", swept: last === "left" ? "right" : null };
  }
  return { last, swept: null };
}

/**
 * Seed the edge tracker when the pointer enters the container, by which half
 * it entered on — so a sweep that happened outside the container (leave left,
 * re-enter right) doesn't count as a sweep.
 */
export function seedEdge(relX: number): Edge {
  return relX < 0.5 ? "left" : "right";
}
