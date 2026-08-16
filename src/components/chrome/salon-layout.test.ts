import { describe, it, expect } from "vitest";
import { justifyRows, type Sized } from "./salon-layout";

const sq: Sized = { width: 100, height: 100 }; // aspect 1
const wide: Sized = { width: 300, height: 100 }; // aspect 3

describe("justifyRows", () => {
  it("packs a row to fill the width at (or below) the target height", () => {
    // 5 squares, no gap: fill height = 1000 / 5 = 200 == target → one row.
    const rows = justifyRows(Array(5).fill(sq), 1000, 0, 200, 300);
    expect(rows).toHaveLength(1);
    expect(rows[0].items).toHaveLength(5);
    expect(rows[0].height).toBeCloseTo(200);
  });

  it("wraps into multiple rows", () => {
    const rows = justifyRows(Array(10).fill(sq), 1000, 0, 200, 300);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.items.length === 5 && Math.abs(r.height - 200) < 1e-6)).toBe(true);
  });

  it("accounts for the gap when sizing a row", () => {
    // 5 squares, gap 10: fill height = (1000 - 40) / 5 = 192.
    const rows = justifyRows(Array(5).fill(sq), 1000, 10, 200, 300);
    expect(rows).toHaveLength(1);
    expect(rows[0].height).toBeCloseTo(192);
  });

  it("every full row's pieces span the container width exactly", () => {
    const gap = 12;
    const width = 1000;
    const rows = justifyRows([wide, sq, sq, wide, sq, sq, sq, wide], width, gap, 200, 400);
    // Only assert on rows that closed by filling (all but possibly the last).
    for (const row of rows.slice(0, -1)) {
      const span =
        row.items.reduce((sum, it) => sum + row.height * (it.width / it.height), 0) +
        gap * (row.items.length - 1);
      expect(span).toBeCloseTo(width);
    }
  });

  it("left-aligns a sparse trailing row at the target instead of ballooning it", () => {
    // 5 fill the first row; 2 left over would need height 500 to fill → capped.
    const rows = justifyRows(Array(7).fill(sq), 1000, 0, 200, 300);
    expect(rows).toHaveLength(2);
    expect(rows[1].items).toHaveLength(2);
    expect(rows[1].height).toBeCloseTo(200); // target, not the 500 that would fill
  });

  it("still justifies a trailing row that nearly fills on its own", () => {
    // 4 leftover squares need height 250 to fill, under maxHeight 300 → justify.
    const rows = justifyRows(Array(9).fill(sq), 1000, 0, 200, 300);
    expect(rows).toHaveLength(2);
    expect(rows[1].items).toHaveLength(4);
    expect(rows[1].height).toBeCloseTo(250);
  });

  it("skips pieces with a non-positive or non-finite aspect ratio", () => {
    const bad = [{ width: 0, height: 100 }, { width: 100, height: 0 }];
    const rows = justifyRows([...bad, sq, sq], 1000, 0, 500, 800);
    const total = rows.reduce((n, r) => n + r.items.length, 0);
    expect(total).toBe(2);
  });

  it("returns no rows for an empty input", () => {
    expect(justifyRows([], 1000, 12, 200, 300)).toEqual([]);
  });
});
