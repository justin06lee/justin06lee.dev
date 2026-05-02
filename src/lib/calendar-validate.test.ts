import { describe, it, expect } from "vitest";
import { parseFallbacksInput, MAX_FALLBACKS } from "@/lib/calendar-validate";

describe("parseFallbacksInput", () => {
  const valid = {
    categoryId: "cat-1",
    title: "running",
    startTime: "07:00",
    endTime: "08:00",
  };

  it("accepts a list of complete alternatives", () => {
    const out = parseFallbacksInput([valid]);
    expect(out).toEqual([valid]);
  });

  it("rejects non-array input", () => {
    expect(parseFallbacksInput(null)).toMatch(/array/i);
    expect(parseFallbacksInput({})).toMatch(/array/i);
    expect(parseFallbacksInput("nope")).toMatch(/array/i);
  });

  it("trims titles", () => {
    const out = parseFallbacksInput([{ ...valid, title: "  running  " }]);
    expect(Array.isArray(out)).toBe(true);
    if (Array.isArray(out)) expect(out[0].title).toBe("running");
  });

  it("rejects missing categoryId", () => {
    const { categoryId: _omitted, ...rest } = valid;
    void _omitted;
    expect(parseFallbacksInput([rest])).toMatch(/categoryId/);
  });

  it("rejects empty title", () => {
    expect(parseFallbacksInput([{ ...valid, title: "   " }])).toMatch(/title/);
  });

  it("rejects malformed start/end", () => {
    expect(parseFallbacksInput([{ ...valid, startTime: "7:00" }])).toMatch(/startTime/);
    expect(parseFallbacksInput([{ ...valid, endTime: "25:00" }])).toMatch(/endTime/);
  });

  it("rejects end <= start", () => {
    expect(parseFallbacksInput([{ ...valid, startTime: "10:00", endTime: "10:00" }])).toMatch(/after/);
    expect(parseFallbacksInput([{ ...valid, startTime: "11:00", endTime: "10:00" }])).toMatch(/after/);
  });

  it("rejects more than MAX_FALLBACKS entries", () => {
    const many = Array.from({ length: MAX_FALLBACKS + 1 }, () => valid);
    expect(parseFallbacksInput(many)).toMatch(new RegExp(`<= ${MAX_FALLBACKS}`));
  });

  it("does not preserve foreign keys on the returned objects", () => {
    const polluted = { ...valid, type: "category", extraneous: 42 };
    const out = parseFallbacksInput([polluted]);
    expect(Array.isArray(out)).toBe(true);
    if (Array.isArray(out)) {
      expect(out[0]).toEqual(valid);
      expect((out[0] as Record<string, unknown>).type).toBeUndefined();
      expect((out[0] as Record<string, unknown>).extraneous).toBeUndefined();
    }
  });
});
