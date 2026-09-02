// Geometry for the CRT's channel dial, kept pure so the detent maths can be
// tested without pointer events or a canvas.
//
// The dial is a rotary channel selector the way old sets had one: it turns
// all the way round, with one detent per channel spread evenly over the full
// circle, so the last channel clicks straight on to the first. The knob's
// angle is a single unbounded number of degrees — it never wraps — and the
// channel is read off it. Between two detents the set is off-station and
// shows static; `staticAmount` says how much.

/** The angle of the picture that is shown around a detent, as a share of the step. */
const HOLD_SHARE = 0.22;
/** How quickly the static comes in past the hold, in degrees (capped for tight steps). */
const RAMP_DEG = 6;

/** Degrees between neighbouring detents for `count` channels; a full turn each for one. */
export function detentStep(count: number): number {
  return 360 / Math.max(1, count);
}

/** The detent (any integer, unbounded) nearest to `angle`. */
export function nearestDetent(angle: number, count: number): number {
  return Math.round(angle / detentStep(count));
}

/** The knob angle of the detent nearest to `angle`. */
export function snapAngle(angle: number, count: number): number {
  return nearestDetent(angle, count) * detentStep(count);
}

/** The channel the set is tuned to at `angle`, wrapping in both directions. */
export function channelAt(angle: number, count: number): number {
  if (count <= 0) return 0;
  return (((nearestDetent(angle, count) % count) + count) % count);
}

/**
 * 0 on a detent, 1 well off-station. The picture holds for a share of the
 * step either side of the detent, then static ramps in over a few degrees,
 * so a knob that is nudged doesn't flash and one that is turned does.
 */
export function staticAmount(angle: number, count: number): number {
  if (count <= 1) return 0;
  const step = detentStep(count);
  const distance = Math.abs(angle - snapAngle(angle, count));
  const hold = step * HOLD_SHARE;
  const ramp = Math.min(RAMP_DEG, step * 0.1);
  const t = (distance - hold) / ramp;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

/**
 * The angle to turn to from `angle` to land on channel `index`, taking the
 * shorter way round (clockwise when the two are equal, so a two-channel set
 * always advances).
 */
export function angleForChannel(angle: number, index: number, count: number): number {
  if (count <= 0) return angle;
  const step = detentStep(count);
  const detent = nearestDetent(angle, count);
  const current = channelAt(angle, count);
  let delta = (((index - current) % count) + count) % count;
  if (delta > count / 2) delta -= count;
  return (detent + delta) * step;
}

/**
 * Pointer position to knob angle, with 0 at 12 o'clock and clockwise positive —
 * the way a dial is read, not the way `atan2` is.
 */
export function pointerAngle(cx: number, cy: number, px: number, py: number): number {
  return (Math.atan2(px - cx, -(py - cy)) * 180) / Math.PI;
}

/**
 * Smallest signed difference between two angles, so a drag that crosses the
 * 180 seam behind the knob doesn't read as a full turn the other way.
 */
export function deltaAngle(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/**
 * Share of the knob's radius round its centre inside which the pointer's
 * angle is too unstable to follow: a pixel of travel there is a quarter turn.
 */
export const DEAD_ZONE = 0.28;
/**
 * The most one pointer sample may turn the knob. A pointer that crosses the
 * middle between two samples reads as half a turn otherwise, and the knob
 * spun.
 */
export const MAX_TURN_DEG = 40;
/** Wheel travel per detent, in pixels. */
export const WHEEL_PX_PER_DETENT = 80;

/**
 * One pointer sample of a drag: how far to turn the knob, and the angle to
 * measure the next sample from. Inside the dead zone nothing turns, but the
 * reference angle still follows the pointer, so leaving the zone doesn't
 * jump the knob to wherever the pointer went in the meantime.
 */
export function pointerTurn(
  last: number,
  cx: number,
  cy: number,
  radius: number,
  px: number,
  py: number,
): { last: number; delta: number } {
  const at = pointerAngle(cx, cy, px, py);
  if (Math.hypot(px - cx, py - cy) < radius * DEAD_ZONE) return { last: at, delta: 0 };
  const delta = Math.max(-MAX_TURN_DEG, Math.min(MAX_TURN_DEG, deltaAngle(last, at)));
  return { last: at, delta };
}

/**
 * Wheel travel into detents: `carry` is the travel left over from the last
 * call, so a slow wheel still adds up to a step. Positive steps are
 * clockwise (scrolling down, as a wheel turns a knob when you roll it).
 */
export function wheelDetents(carry: number, deltaY: number): { carry: number; steps: number } {
  const total = carry + deltaY;
  const steps = Math.trunc(total / WHEEL_PX_PER_DETENT);
  return { carry: total - steps * WHEEL_PX_PER_DETENT, steps };
}
