// Pure row packing for `salon`, extracted so the geometry can be tested without
// a DOM. Pieces are laid at a common target height (keeping their aspect, so
// widths vary) and wrapped when the next piece would push the row past the
// container width. Rows are NOT stretched to a uniform width — each row ends at
// its own natural width, so the wall has a ragged right edge and one row's
// length never forces the others wider or narrower. The only piece ever scaled
// down is a single piece so wide it alone exceeds the container, so nothing
// overflows and nothing is cropped.

export type Sized = { width: number; height: number };
export type JustifiedRow<T> = { items: T[]; height: number };

/**
 * Pack `items` into ragged rows at `targetHeight`.
 *
 * Each row grows left to right at the target height until the next piece would
 * exceed `containerWidth`, then wraps. A row keeps its natural width (ragged);
 * it is only scaled down when a lone piece is wider than the container, so the
 * row still fits without cropping. Pieces with a non-positive or non-finite
 * aspect ratio are skipped.
 */
export function justifyRows<T extends Sized>(
  items: T[],
  containerWidth: number,
  gap: number,
  targetHeight: number,
): JustifiedRow<T>[] {
  const rows: JustifiedRow<T>[] = [];
  let row: { item: T; ar: number }[] = [];

  const rowWidthAtTarget = (entries: { ar: number }[]) =>
    entries.reduce((sum, e) => sum + e.ar, 0) * targetHeight + gap * (entries.length - 1);

  const finalize = (entries: { item: T; ar: number }[]) => {
    const natural = rowWidthAtTarget(entries);
    // A lone piece (or an unusually wide row) that overruns the container is
    // scaled down to fit — the only time width is sacrificed, and never by crop.
    const height = natural > containerWidth ? targetHeight * (containerWidth / natural) : targetHeight;
    return { items: entries.map((e) => e.item), height };
  };

  for (const item of items) {
    const ar = item.width / item.height;
    if (!Number.isFinite(ar) || ar <= 0) continue;
    if (row.length > 0 && rowWidthAtTarget([...row, { item, ar }]) > containerWidth) {
      rows.push(finalize(row));
      row = [];
    }
    row.push({ item, ar });
  }

  if (row.length) rows.push(finalize(row));
  return rows;
}
