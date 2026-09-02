import { describe, expect, it } from "vitest";
import {
  angleForChannel,
  channelAt,
  deltaAngle,
  detentStep,
  nearestDetent,
  pointerAngle,
  snapAngle,
  staticAmount,
} from "./crt-dial";

describe("detents", () => {
  it("spreads the channels over the whole circle", () => {
    expect(detentStep(2)).toBe(180);
    expect(detentStep(4)).toBe(90);
    expect(detentStep(1)).toBe(360);
    expect(detentStep(0)).toBe(360);
  });

  it("snaps a free angle to the nearest stop, past a full turn either way", () => {
    expect(nearestDetent(80, 2)).toBe(0);
    expect(nearestDetent(100, 2)).toBe(1);
    expect(nearestDetent(-100, 2)).toBe(-1);
    expect(nearestDetent(730, 4)).toBe(8);
    expect(snapAngle(100, 2)).toBe(180);
    expect(snapAngle(-100, 2)).toBe(-180);
  });

  it("reads the channel off the angle, wrapping in both directions", () => {
    // Two channels: one, two, back to one — and the same going backwards.
    expect(channelAt(0, 2)).toBe(0);
    expect(channelAt(180, 2)).toBe(1);
    expect(channelAt(360, 2)).toBe(0);
    expect(channelAt(-180, 2)).toBe(1);
    expect(channelAt(-360, 2)).toBe(0);
    expect(channelAt(270, 4)).toBe(3);
    expect(channelAt(-90, 4)).toBe(3);
    expect(channelAt(1000, 0)).toBe(0);
  });
});

describe("staticAmount", () => {
  it("holds the picture around a detent and is full static in between", () => {
    expect(staticAmount(0, 2)).toBe(0);
    expect(staticAmount(20, 2)).toBe(0);
    expect(staticAmount(90, 2)).toBe(1);
    expect(staticAmount(-90, 2)).toBe(1);
    expect(staticAmount(180, 2)).toBe(0);
    expect(staticAmount(45, 4)).toBe(1);
  });

  it("ramps rather than flips", () => {
    const step = detentStep(2);
    const hold = step * 0.22;
    const mid = staticAmount(hold + 3, 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(staticAmount(hold + 7, 2)).toBe(1);
  });

  it("never shows static with a single channel", () => {
    expect(staticAmount(123, 1)).toBe(0);
    expect(staticAmount(123, 0)).toBe(0);
  });
});

describe("angleForChannel", () => {
  it("takes the shorter way round", () => {
    expect(angleForChannel(0, 3, 4)).toBe(-90);
    expect(angleForChannel(0, 1, 4)).toBe(90);
    expect(angleForChannel(0, 2, 4)).toBe(180);
  });

  it("advances clockwise on a two-channel set", () => {
    expect(angleForChannel(0, 1, 2)).toBe(180);
    expect(angleForChannel(180, 0, 2)).toBe(360);
  });

  it("keeps the turn count the knob has already accumulated", () => {
    expect(angleForChannel(720, 1, 4)).toBe(810);
    expect(angleForChannel(725, 0, 4)).toBe(720);
  });

  it("is a no-op for the current channel", () => {
    expect(angleForChannel(90, 1, 4)).toBe(90);
    expect(angleForChannel(50, 0, 0)).toBe(50);
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
