// Pure row packing for `salon`, extracted so the geometry can be tested without
// a DOM. This is the justified-gallery algorithm: pieces keep their aspect and
// each row is scaled to fill the container width, so rows read full rather than
// ragged. Row height stays near `targetHeight` — the effective minimum piece
// size — by choosing, at each break, whether including the next piece or
// deferring it lands closer to the target. What gets sacrificed to fill is the
// row's exact width via a small height wobble, never the piece size shrinking
// away; only the trailing leftover row is capped so a lone piece can't balloon.

export type Sized = { width: number; height: number };
export type JustifiedRow<T> = { items: T[]; height: number };

/**
 * Pack `items` into justified rows that each fill `containerWidth`.
 *
 * Rows accumulate pieces until adding the next would pull the fill height below
 * `targetHeight`; at that point the row closes on whichever side (with or
 * without the piece) sits closer to the target, keeping every full row near the
 * target height and spanning the width. The final, leftover row fills only if it
 * nearly does on its own, and is otherwise capped at `targetHeight * 1.3` so a
 * stray piece sits at a sane size instead of stretching across. Pieces with a
 * non-positive or non-finite aspect ratio are skipped.
 */
export function justifyRows<T extends Sized>(
  items: T[],
  containerWidth: number,
  gap: number,
  targetHeight: number,
): JustifiedRow<T>[] {
  const rows: JustifiedRow<T>[] = [];
  let row: { item: T; ar: number }[] = [];
  let arSum = 0;

  const fillHeight = (count: number, aspectSum: number) =>
    (containerWidth - gap * (count - 1)) / aspectSum;

  const close = (entries: { item: T; ar: number }[], height: number) =>
    rows.push({ items: entries.map((e) => e.item), height });

  for (const item of items) {
    const ar = item.width / item.height;
    if (!Number.isFinite(ar) || ar <= 0) continue;

    const heightWith = fillHeight(row.length + 1, arSum + ar);
    if (row.length > 0 && heightWith < targetHeight) {
      const heightWithout = fillHeight(row.length, arSum);
      if (targetHeight - heightWith <= heightWithout - targetHeight) {
        // Including the piece lands closer to the target — keep it, close here.
        row.push({ item, ar });
        close(row, heightWith);
      } else {
        // Deferring lands closer — close without it, carry it to the next row.
        close(row, heightWithout);
        row = [{ item, ar }];
        arSum = ar;
        continue;
      }
      row = [];
      arSum = 0;
    } else {
      row.push({ item, ar });
      arSum += ar;
    }
  }

  if (row.length) {
    const height = Math.min(fillHeight(row.length, arSum), targetHeight * 1.3);
    close(row, height);
  }

  return rows;
}
