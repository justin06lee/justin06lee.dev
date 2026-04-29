import { describe, it, expect } from "vitest";
import {
  epochToDateInTz,
  epochToMinutesOfDay,
  clampActualToDay,
  hhmmToMinutes,
  intervalIntersectionMinutes,
  addDays,
  monthRange,
  buildMonthGrid,
  isValidDateString,
  isValidYearMonthString,
  isValidYearString,
  isValidHhmm,
  epochToLocalInput,
  localInputToEpoch,
  overlapIntensityClass,
} from "@/lib/calendar-dates";

const NYC = "America/New_York";
const UTC = "UTC";

describe("epochToDateInTz", () => {
  it("returns YYYY-MM-DD for an epoch in the given tz", () => {
    const ms = Date.UTC(2026, 3, 26, 12, 0, 0);
    expect(epochToDateInTz(ms, NYC)).toBe("2026-04-26");
  });
  it("rolls back across the tz boundary", () => {
    const ms = Date.UTC(2026, 3, 27, 3, 0, 0);
    expect(epochToDateInTz(ms, NYC)).toBe("2026-04-26");
  });
});

describe("epochToMinutesOfDay", () => {
  it("returns minutes since midnight in tz", () => {
    const ms = Date.UTC(2026, 3, 26, 12, 30, 0);
    expect(epochToMinutesOfDay(ms, NYC)).toBe(8 * 60 + 30);
  });
  it("returns 0 at midnight in NYC (not UTC)", () => {
    // 2026-04-26 00:00 NYC = 04:00Z (EDT = UTC-4)
    const nycMidnight = Date.UTC(2026, 3, 26, 4, 0, 0);
    expect(epochToMinutesOfDay(nycMidnight, NYC)).toBe(0);
  });
});

describe("clampActualToDay", () => {
  it("returns full block when fully inside the day", () => {
    const start = Date.UTC(2026, 3, 26, 10, 0, 0);
    const end = Date.UTC(2026, 3, 26, 11, 30, 0);
    const r = clampActualToDay("2026-04-26", start, end, UTC);
    expect(r).toEqual({ startMin: 600, endMin: 690 });
  });
  it("clamps left edge for blocks that started yesterday", () => {
    const start = Date.UTC(2026, 3, 25, 23, 0, 0);
    const end = Date.UTC(2026, 3, 26, 6, 0, 0);
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

describe("hhmmToMinutes", () => {
  it("parses HH:MM", () => {
    expect(hhmmToMinutes("07:30")).toBe(450);
    expect(hhmmToMinutes("00:00")).toBe(0);
    expect(hhmmToMinutes("23:59")).toBe(23 * 60 + 59);
  });
  it("returns null for null input", () => {
    expect(hhmmToMinutes(null)).toBeNull();
  });
  it("returns null for malformed input", () => {
    expect(hhmmToMinutes("9:00")).toBeNull();
    expect(hhmmToMinutes("99:99")).toBeNull();
    expect(hhmmToMinutes("ab:cd")).toBeNull();
  });
});

describe("intervalIntersectionMinutes", () => {
  it("returns 0 for disjoint sets", () => {
    expect(intervalIntersectionMinutes([[0, 60]], [[120, 180]])).toBe(0);
  });
  it("returns the inner interval when one contains the other", () => {
    expect(intervalIntersectionMinutes([[0, 120]], [[30, 90]])).toBe(60);
  });
  it("merges overlapping intervals within a side before intersecting", () => {
    expect(intervalIntersectionMinutes([[0, 60], [40, 120]], [[30, 150]])).toBe(90);
  });
  it("sums multiple disjoint intersections", () => {
    expect(
      intervalIntersectionMinutes([[0, 30], [60, 90], [120, 150]], [[0, 200]]),
    ).toBe(90);
  });
  it("ignores zero-length and inverted intervals", () => {
    expect(intervalIntersectionMinutes([[60, 60], [70, 50]], [[0, 200]])).toBe(0);
  });
  it("returns 0 when either side is empty", () => {
    expect(intervalIntersectionMinutes([], [[0, 60]])).toBe(0);
    expect(intervalIntersectionMinutes([[0, 60]], [])).toBe(0);
  });
});

describe("addDays", () => {
  it("adds positive days", () => {
    expect(addDays("2026-04-26", 1)).toBe("2026-04-27");
  });
  it("subtracts negative days", () => {
    expect(addDays("2026-04-01", -1)).toBe("2026-03-31");
  });
  it("crosses month boundaries", () => {
    expect(addDays("2026-04-30", 1)).toBe("2026-05-01");
  });
  it("crosses year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("handles leap year (2024 has Feb 29)", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
  });
  it("handles non-leap year (2025 has Feb 28 only)", () => {
    expect(addDays("2025-02-28", 1)).toBe("2025-03-01");
  });
});

describe("monthRange", () => {
  it("returns first and last day of the month", () => {
    expect(monthRange("2026-04")).toEqual({ from: "2026-04-01", to: "2026-04-30" });
  });
  it("handles February in a leap year", () => {
    expect(monthRange("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });
  it("handles February in a non-leap year", () => {
    expect(monthRange("2025-02")).toEqual({ from: "2025-02-01", to: "2025-02-28" });
  });
  it("handles December", () => {
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
});

describe("buildMonthGrid", () => {
  it("returns a multiple-of-7 length grid", () => {
    expect(buildMonthGrid("2026-04").length % 7).toBe(0);
  });
  it("pads with nulls before the 1st (Sunday-aligned)", () => {
    // 2026-04-01 is a Wednesday — 3 leading nulls.
    const cells = buildMonthGrid("2026-04");
    expect(cells.slice(0, 3)).toEqual([null, null, null]);
    expect(cells[3]).toBe("2026-04-01");
  });
  it("emits all days of the month", () => {
    const cells = buildMonthGrid("2026-04").filter((c) => c !== null);
    expect(cells.length).toBe(30);
    expect(cells[0]).toBe("2026-04-01");
    expect(cells[29]).toBe("2026-04-30");
  });
});

describe("isValidDateString", () => {
  it("accepts well-formed dates", () => {
    expect(isValidDateString("2026-04-26")).toBe(true);
    expect(isValidDateString("2024-02-29")).toBe(true);
  });
  it("rejects ill-formed strings", () => {
    expect(isValidDateString("2026-4-26")).toBe(false);
    expect(isValidDateString("2026/04/26")).toBe(false);
    expect(isValidDateString("not-a-date")).toBe(false);
  });
  it("rejects impossible dates", () => {
    expect(isValidDateString("2025-02-29")).toBe(false); // not a leap year
    expect(isValidDateString("2026-13-01")).toBe(false);
    expect(isValidDateString("2026-04-31")).toBe(false);
  });
});

describe("isValidYearMonthString", () => {
  it("accepts YYYY-MM in valid month range", () => {
    expect(isValidYearMonthString("2026-04")).toBe(true);
    expect(isValidYearMonthString("2026-12")).toBe(true);
    expect(isValidYearMonthString("2026-01")).toBe(true);
  });
  it("rejects invalid month numbers", () => {
    expect(isValidYearMonthString("2026-00")).toBe(false);
    expect(isValidYearMonthString("2026-13")).toBe(false);
  });
  it("rejects malformed strings", () => {
    expect(isValidYearMonthString("2026-4")).toBe(false);
    expect(isValidYearMonthString("2026")).toBe(false);
  });
});

describe("isValidYearString", () => {
  it("accepts 4-digit years", () => {
    expect(isValidYearString("2026")).toBe(true);
  });
  it("rejects non-4-digit", () => {
    expect(isValidYearString("026")).toBe(false);
    expect(isValidYearString("20266")).toBe(false);
    expect(isValidYearString("abcd")).toBe(false);
  });
});

describe("isValidHhmm", () => {
  it("accepts valid times", () => {
    expect(isValidHhmm("00:00")).toBe(true);
    expect(isValidHhmm("23:59")).toBe(true);
    expect(isValidHhmm("09:00")).toBe(true);
  });
  it("rejects invalid times", () => {
    expect(isValidHhmm("9:00")).toBe(false);
    expect(isValidHhmm("24:00")).toBe(false);
    expect(isValidHhmm("99:99")).toBe(false);
  });
});

describe("epochToLocalInput / localInputToEpoch", () => {
  it("round-trips a UTC epoch through UTC tz", () => {
    const epoch = Date.UTC(2026, 3, 26, 14, 30);
    const s = epochToLocalInput(epoch, UTC);
    expect(s).toBe("2026-04-26T14:30");
    expect(localInputToEpoch(s, UTC)).toBe(epoch);
  });
  it("round-trips through NYC tz across EDT (DST in effect)", () => {
    // 2026-04-26 09:30 EDT = 13:30Z
    const epoch = Date.UTC(2026, 3, 26, 13, 30);
    const s = epochToLocalInput(epoch, NYC);
    expect(s).toBe("2026-04-26T09:30");
    expect(localInputToEpoch(s, NYC)).toBe(epoch);
  });
  it("round-trips just before NYC spring-forward (EST → EDT, 2026-03-08)", () => {
    // 2026-03-08 01:30 EST exists; 02:00 EST → 03:00 EDT (no 02:30).
    // 01:30 EST = 06:30Z.
    const epoch = Date.UTC(2026, 2, 8, 6, 30);
    const s = epochToLocalInput(epoch, NYC);
    expect(s).toBe("2026-03-08T01:30");
    expect(localInputToEpoch(s, NYC)).toBe(epoch);
  });
  it("round-trips after NYC spring-forward (EDT)", () => {
    // 2026-03-08 03:30 EDT = 07:30Z.
    const epoch = Date.UTC(2026, 2, 8, 7, 30);
    const s = epochToLocalInput(epoch, NYC);
    expect(s).toBe("2026-03-08T03:30");
    expect(localInputToEpoch(s, NYC)).toBe(epoch);
  });
  it("returns NaN for malformed input", () => {
    expect(localInputToEpoch("not-a-date", UTC)).toBeNaN();
    expect(localInputToEpoch("", UTC)).toBeNaN();
  });
});

describe("overlapIntensityClass", () => {
  it("returns the lowest bucket for 0 minutes", () => {
    expect(overlapIntensityClass(0, "year")).toBe("bg-white/[0.04]");
    expect(overlapIntensityClass(0, "month")).toBe("");
  });
  it("scales monotonically with minutes", () => {
    const buckets = [
      overlapIntensityClass(0, "year"),
      overlapIntensityClass(20, "year"),
      overlapIntensityClass(60, "year"),
      overlapIntensityClass(150, "year"),
      overlapIntensityClass(240, "year"),
    ];
    // Each bucket should be different (assuming the scale is monotonic).
    expect(new Set(buckets).size).toBe(5);
  });
  it("clamps high values into the top bucket", () => {
    expect(overlapIntensityClass(10_000, "year")).toBe("bg-white/85");
    expect(overlapIntensityClass(10_000, "month")).toBe("bg-white/[0.18]");
  });
});
