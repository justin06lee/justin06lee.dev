import { describe, expect, it } from "vitest";
import {
  DIAL_MAX_STEP,
  DIAL_SWEEP,
  clampAngle,
  deltaAngle,
  detentAngle,
  detentStep,
  nearestDetent,
  pointerAngle,
  stepChannel,
} from "./crt-dial";

describe("detents", () => {
  it("reads as a switch for two channels rather than a half turn", () => {
    expect(detentStep(2)).toBe(DIAL_MAX_STEP);
    expect(detentAngle(0, 2)).toBe(-30);
    expect(detentAngle(1, 2)).toBe(30);
  });

  it("spreads many channels across the sweep", () => {
    const count = 12;
    expect(detentStep(count)).toBeCloseTo(DIAL_SWEEP / (count - 1));
    expect(detentAngle(0, count)).toBeCloseTo(-DIAL_SWEEP / 2);
    expect(detentAngle(count - 1, count)).toBeCloseTo(DIAL_SWEEP / 2);
  });

  it("is centred on twelve o'clock", () => {
    for (const count of [1, 2, 3, 5, 8]) {
      const angles = Array.from({ length: count }, (_, i) => detentAngle(i, count));
      expect(angles.reduce((a, b) => a + b, 0), `count ${count}`).toBeCloseTo(0);
    }
    expect(detentAngle(0, 1)).toBe(0);
  });

  it("snaps a free angle to the nearest stop and clamps past the ends", () => {
    expect(nearestDetent(-29, 2)).toBe(0);
    expect(nearestDetent(2, 2)).toBe(1);
    expect(nearestDetent(-500, 2)).toBe(0);
    expect(nearestDetent(500, 2)).toBe(1);
    expect(nearestDetent(0, 3)).toBe(1);
    expect(nearestDetent(0, 1)).toBe(0);
  });

  it("does not let the knob be dragged past the last stop", () => {
    expect(clampAngle(200, 2)).toBe(30);
    expect(clampAngle(-200, 2)).toBe(-30);
    expect(clampAngle(10, 2)).toBe(10);
  });
});

describe("pointerAngle", () => {
  it("puts twelve o'clock at zero and runs clockwise", () => {
    expect(pointerAngle(0, 0, 0, -10)).toBeCloseTo(0);
    expect(pointerAngle(0, 0, 10, 0)).toBeCloseTo(90);
    expect(pointerAngle(0, 0, 0, 10)).toBeCloseTo(180);
    expect(pointerAngle(0, 0, -10, 0)).toBeCloseTo(-90);
  });
});

describe("deltaAngle", () => {
  it("takes the short way round across the seam behind the knob", () => {
    expect(deltaAngle(170, -170)).toBe(20);
    expect(deltaAngle(-170, 170)).toBe(-20);
    expect(deltaAngle(10, 30)).toBe(20);
  });
});

describe("stepChannel", () => {
  it("wraps in both directions", () => {
    expect(stepChannel(1, 1, 2)).toBe(0);
    expect(stepChannel(0, -1, 2)).toBe(1);
    expect(stepChannel(0, 1, 0)).toBe(0);
  });
});
