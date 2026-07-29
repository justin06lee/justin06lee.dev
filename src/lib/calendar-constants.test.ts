import { describe, it, expect } from "vitest";
import { isValidTrack, MAX_TRACK, PRIMARY_TRACK } from "@/lib/calendar-constants";

describe("isValidTrack", () => {
  it("accepts every addressable lane", () => {
    for (let t = PRIMARY_TRACK; t <= MAX_TRACK; t++) {
      expect(isValidTrack(t)).toBe(true);
    }
  });

  it("rejects lanes outside the range", () => {
    expect(isValidTrack(PRIMARY_TRACK - 1)).toBe(false);
    expect(isValidTrack(MAX_TRACK + 1)).toBe(false);
    expect(isValidTrack(999)).toBe(false);
  });

  it("rejects non-integers", () => {
    // Guards the partial UNIQUE index: SQLite would happily store 1.5 as a
    // distinct lane, silently letting two rows run on what the UI calls lane 1.
    expect(isValidTrack(1.5)).toBe(false);
    expect(isValidTrack(NaN)).toBe(false);
    expect(isValidTrack(Infinity)).toBe(false);
  });

  it("rejects non-numbers, including numeric strings", () => {
    // JSON bodies are untyped; "1" must not sneak through as lane 1.
    expect(isValidTrack("1")).toBe(false);
    expect(isValidTrack(null)).toBe(false);
    expect(isValidTrack(undefined)).toBe(false);
    expect(isValidTrack({})).toBe(false);
  });

  it("treats the primary lane as the back-compat default", () => {
    // Everything written before parallel tracks lives on lane 0, so it must
    // always be valid — the migration backfills existing rows to exactly this.
    expect(PRIMARY_TRACK).toBe(0);
    expect(isValidTrack(PRIMARY_TRACK)).toBe(true);
  });
});
