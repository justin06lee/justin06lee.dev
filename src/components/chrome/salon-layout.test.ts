import { describe, it, expect } from "vitest";
import { justifyRows, type Sized } from "./salon-layout";

const sq: Sized = { width: 100, height: 100 }; // aspect 1
const wide: Sized = { width: 300, height: 100 }; // aspect 3
const tall: Sized = { width: 100, height: 300 }; // aspect 1/3

const rowWidth = (items: Sized[], height: number, gap: number) =>
  items.reduce((sum, it) => sum + height * (it.width / it.height), 0) + gap * (items.length - 1);

describe("justifyRows (justified fill)", () => {
  it("scales every full (non-trailing) row to span the container width", () => {
    const rows = justifyRows([...Array(6).fill(sq), wide, sq, sq, tall, sq], 1000, 8, 200);
    for (const row of rows.slice(0, -1)) {
      expect(rowWidth(row.items, row.height, 8)).toBeCloseTo(1000);
    }
  });

  it("keeps full-row heights near the target (not shrunk away)", () => {
    const rows = justifyRows(Array(11).fill(sq), 1000, 0, 200);
    for (const row of rows.slice(0, -1)) {
      // 5 squares fill 1000 at exactly the target; tolerance never drops it far below.
      expect(row.height).toBeGreaterThan(160);
      expect(row.height).toBeLessThanOrEqual(260);
    }
  });

  it("closes a row on the side (with/without the next piece) closer to the target", () => {
    // 6 squares: 5 fill 1000 at height 200 (on target); the 6th defers.
    const rows = justifyRows(Array(6).fill(sq), 1000, 0, 200);
    expect(rows[0].items).toHaveLength(5);
    expect(rows[0].height).toBeCloseTo(200);
    expect(rowWidth(rows[0].items, rows[0].height, 0)).toBeCloseTo(1000);
  });

  it("caps a lone trailing piece instead of ballooning it across the width", () => {
    const rows = justifyRows(Array(6).fill(sq), 1000, 0, 200);
    expect(rows[1].items).toHaveLength(1);
    // would fill at height 1000; capped at target * 1.3 = 260.
    expect(rows[1].height).toBeCloseTo(260);
  });

  it("lets a nearly-full trailing row fill when it can within the cap", () => {
    // 4 leftover squares fill 1000 at height 250, under the 260 cap → fills.
    const rows = justifyRows(Array(9).fill(sq), 1000, 0, 200);
    const last = rows[rows.length - 1];
    expect(last.items).toHaveLength(4);
    expect(last.height).toBeCloseTo(250);
    expect(rowWidth(last.items, last.height, 0)).toBeCloseTo(1000);
  });

  it("accounts for the gap when sizing a row to fill the width", () => {
    const rows = justifyRows(Array(6).fill(sq), 1000, 20, 200);
    // 5 squares + 4 gaps of 20 fill 1000 at height (1000-80)/5 = 184.
    expect(rows[0].items).toHaveLength(5);
    expect(rows[0].height).toBeCloseTo(184);
    expect(rowWidth(rows[0].items, rows[0].height, 20)).toBeCloseTo(1000);
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
