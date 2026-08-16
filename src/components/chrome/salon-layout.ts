// Pure justified-row packing for `salon`, extracted so the geometry can be
// tested without a DOM. Given the pieces' aspect ratios and a container width,
// it groups them into rows that each span the width at a shared height near the
// target — the standard greedy justified-gallery algorithm.

export type Sized = { width: number; height: number };
export type JustifiedRow<T> = { items: T[]; height: number };

/**
 * Pack `items` into justified rows.
 *
 * Each non-final row closes at the height that makes its pieces span
 * `containerWidth` exactly (so the row is at most `targetHeight` tall). The
 * final row justifies too when it nearly fills on its own, but otherwise sits
 * left-aligned at `targetHeight` rather than stretching a stray piece past
 * `maxHeight` into a billboard.
 *
 * Pieces with a non-positive or non-finite aspect ratio are skipped.
 */
export function justifyRows<T extends Sized>(
  items: T[],
  containerWidth: number,
  gap: number,
  targetHeight: number,
  maxHeight: number,
): JustifiedRow<T>[] {
  const rows: JustifiedRow<T>[] = [];
  let row: T[] = [];
  let arSum = 0;

  const fillHeight = (count: number, aspectSum: number) =>
    (containerWidth - gap * (count - 1)) / aspectSum;

  for (const item of items) {
    const ar = item.width / item.height;
    if (!Number.isFinite(ar) || ar <= 0) continue;
    row.push(item);
    arSum += ar;
    const h = fillHeight(row.length, arSum);
    if (h <= targetHeight) {
      rows.push({ items: row, height: h });
      row = [];
      arSum = 0;
    }
  }

  if (row.length) {
    const h = fillHeight(row.length, arSum);
    rows.push({ items: row, height: h <= maxHeight ? h : targetHeight });
  }

  return rows;
}
