import { describe, it, expect } from "vitest";
import { justifyRows, type Sized } from "./salon-layout";

const sq: Sized = { width: 100, height: 100 }; // aspect 1
const wide: Sized = { width: 600, height: 100 }; // aspect 6

const rowWidth = (items: Sized[], height: number, gap: number) =>
  items.reduce((sum, it) => sum + height * (it.width / it.height), 0) + gap * (items.length - 1);

describe("justifyRows (ragged rows at a target height)", () => {
  it("lays every piece at the target height", () => {
    const rows = justifyRows(Array(5).fill(sq), 1000, 0, 200);
    expect(rows).toHaveLength(1);
    expect(rows[0].items).toHaveLength(5);
    expect(rows[0].height).toBeCloseTo(200);
  });

  it("wraps when the next piece would run past the container", () => {
    // 5 squares at h=200 exactly span 1000; a 6th wraps.
    const rows = justifyRows(Array(6).fill(sq), 1000, 0, 200);
    expect(rows).toHaveLength(2);
    expect(rows[0].items).toHaveLength(5);
    expect(rows[1].items).toHaveLength(1);
  });

  it("leaves rows ragged — a sparse row keeps its natural (narrower) width, still at target height", () => {
    const rows = justifyRows(Array(6).fill(sq), 1000, 0, 200);
    expect(rows[1].height).toBeCloseTo(200); // NOT stretched to fill
    expect(rowWidth(rows[1].items, rows[1].height, 0)).toBeLessThan(1000);
  });

  it("gives each row its own width — one row's length doesn't force another's", () => {
    // squares then a very wide piece: two rows of different natural widths.
    const rows = justifyRows([sq, sq, wide, sq], 1000, 0, 200);
    const widths = rows.map((r) => rowWidth(r.items, r.height, 0));
    // no row exceeds the container, and they are not all equal
    for (const w of widths) expect(w).toBeLessThanOrEqual(1000 + 1e-6);
    expect(new Set(widths.map((w) => Math.round(w))).size).toBeGreaterThan(1);
  });

  it("accounts for the gap when deciding where to wrap", () => {
    // 4 squares + 3 gaps of 10 = 830 <= 1000; a 5th (1040) wraps.
    const rows = justifyRows(Array(5).fill(sq), 1000, 10, 200);
    expect(rows[0].items).toHaveLength(4);
    expect(rows[1].items).toHaveLength(1);
  });

  it("scales down only a lone piece wider than the container (never crops, never overflows)", () => {
    // one 6:1 piece at h=200 would be 1200 wide > 1000 → scaled to fit.
    const rows = justifyRows([wide], 1000, 0, 200);
    expect(rows).toHaveLength(1);
    expect(rows[0].height).toBeCloseTo(200 * (1000 / 1200)); // ~166.7
    expect(rowWidth(rows[0].items, rows[0].height, 0)).toBeCloseTo(1000);
  });

  it("skips pieces with a non-positive or non-finite aspect ratio", () => {
    const bad = [{ width: 0, height: 100 }, { width: 100, height: 0 }];
    const rows = justifyRows([...bad, sq, sq], 1000, 0, 200);
    const total = rows.reduce((n, r) => n + r.items.length, 0);
    expect(total).toBe(2);
  });

  it("returns no rows for an empty input", () => {
    expect(justifyRows([], 1000, 12, 200)).toEqual([]);
  });
});
