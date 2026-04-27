import { describe, it, expect } from "vitest";
import {
  epochToDateInTz,
  epochToMinutesOfDay,
  clampActualToDay,
  hhmmToMinutes,
} from "./date-utils";

const NYC = "America/New_York";
const UTC = "UTC";

describe("epochToDateInTz", () => {
  it("returns YYYY-MM-DD for an epoch in the given tz", () => {
    // 2026-04-26T12:00:00Z → in NYC that's 2026-04-26 (08:00 EDT)
    const ms = Date.UTC(2026, 3, 26, 12, 0, 0);
    expect(epochToDateInTz(ms, NYC)).toBe("2026-04-26");
  });
  it("rolls back across the tz boundary", () => {
    // 2026-04-27T03:00:00Z is still 2026-04-26 23:00 in NYC
    const ms = Date.UTC(2026, 3, 27, 3, 0, 0);
    expect(epochToDateInTz(ms, NYC)).toBe("2026-04-26");
  });
});

describe("epochToMinutesOfDay", () => {
  it("returns minutes since midnight in tz", () => {
    // 2026-04-26 08:30 NYC = 12:30Z (EDT = UTC-4)
    const ms = Date.UTC(2026, 3, 26, 12, 30, 0);
    expect(epochToMinutesOfDay(ms, NYC)).toBe(8 * 60 + 30);
  });
  it("returns 0 at midnight in tz", () => {
    // 2026-04-26 00:00 UTC
    const ms = Date.UTC(2026, 3, 26, 0, 0, 0);
    expect(epochToMinutesOfDay(ms, UTC)).toBe(0);
  });
});

describe("clampActualToDay", () => {
  it("returns full block when fully inside the day", () => {
    const start = Date.UTC(2026, 3, 26, 10, 0, 0); // 10:00Z
    const end = Date.UTC(2026, 3, 26, 11, 30, 0); // 11:30Z
    const r = clampActualToDay("2026-04-26", start, end, UTC);
    expect(r).toEqual({ startMin: 600, endMin: 690 });
  });
  it("clamps left edge for blocks that started yesterday", () => {
    const start = Date.UTC(2026, 3, 25, 23, 0, 0); // 23:00Z prev day
    const end = Date.UTC(2026, 3, 26, 6, 0, 0); // 06:00Z today
    const r = clampActualToDay("2026-04-26", start, end, UTC);
    expect(r).toEqual({ startMin: 0, endMin: 360 });
  });
  it("clamps right edge for blocks that continue into tomorrow", () => {
    const start = Date.UTC(2026, 3, 26, 22, 0, 0);
    const end = Date.UTC(2026, 3, 27, 4, 0, 0);
    const r = clampActualToDay("2026-04-26", start, end, UTC);
    expect(r).toEqual({ startMin: 22 * 60, endMin: 1440 });
  });
  it("treats null end as 'now' (unbounded right)", () => {
    const now = Date.UTC(2026, 3, 26, 9, 15, 0);
    const start = Date.UTC(2026, 3, 26, 8, 0, 0);
    const r = clampActualToDay("2026-04-26", start, null, UTC, now);
    expect(r).toEqual({ startMin: 480, endMin: 9 * 60 + 15 });
  });
  it("returns null when block doesn't intersect the day at all", () => {
    const start = Date.UTC(2026, 3, 24, 10, 0, 0);
    const end = Date.UTC(2026, 3, 24, 11, 0, 0);
    expect(clampActualToDay("2026-04-26", start, end, UTC)).toBeNull();
  });
});

describe("hhmmToMinutes (existing)", () => {
  it("still works", () => {
    expect(hhmmToMinutes("07:30")).toBe(450);
    expect(hhmmToMinutes(null)).toBeNull();
  });
});
