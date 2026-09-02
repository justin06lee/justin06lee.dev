import { describe, expect, it } from "vitest";
import { MAX_TURN_DEG, angleForChannel, channelAt, deltaAngle, detentStep, nearestDetent, pointerAngle, pointerTurn, snapAngle, staticAmount, wheelDetents } from "./crt-dial";

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

describe("pointerTurn", () => {
  it("follows the pointer round the knob", () => {
    // From 12 o'clock to 3 o'clock, radius 50, pointer on the rim.
    expect(pointerTurn(0, 100, 100, 50, 150, 100)).toEqual({ last: 90, delta: 90 > MAX_TURN_DEG ? MAX_TURN_DEG : 90 });
    expect(pointerTurn(80, 100, 100, 50, 150, 100).delta).toBeCloseTo(10);
  });

  it("does not turn inside the dead zone, but keeps its bearings", () => {
    const r = pointerTurn(0, 100, 100, 50, 100 + 5, 100 - 5);
    expect(r.delta).toBe(0);
    expect(r.last).toBeCloseTo(45);
  });

  it("clamps a jump across the middle", () => {
    expect(pointerTurn(0, 100, 100, 50, 100, 150).delta).toBe(MAX_TURN_DEG);
    expect(pointerTurn(0, 100, 100, 50, 100 - 1, 150).delta).toBe(-MAX_TURN_DEG);
  });

  it("crosses the seam behind the knob without a full turn", () => {
    // From 170° to -170° is 20° clockwise, not 340° the other way.
    const at = pointerTurn(170, 0, 0, 10, Math.sin((-170 * Math.PI) / 180) * 10, -Math.cos((-170 * Math.PI) / 180) * 10);
    expect(at.delta).toBeCloseTo(20);
  });
});

describe("wheelDetents", () => {
  it("adds slow travel up to a step", () => {
    const a = wheelDetents(0, 50);
    expect(a).toEqual({ carry: 50, steps: 0 });
    expect(wheelDetents(a.carry, 50)).toEqual({ carry: 20, steps: 1 });
  });

  it("steps the other way for the other direction, and several at once", () => {
    expect(wheelDetents(0, -170)).toEqual({ carry: -10, steps: -2 });
  });
});
