// Geometry for the CRT's channel dial, kept pure so the detent maths can be
// tested without pointer events or a canvas.

/** Widest the knob will sweep end to end, in degrees. */
export const DIAL_SWEEP = 270;
/** Widest gap between two detents — two channels should read as a switch, not a half turn. */
export const DIAL_MAX_STEP = 60;

/** Degrees between neighbouring detents for `count` channels. */
export function detentStep(count: number): number {
  if (count <= 1) return 0;
  return Math.min(DIAL_MAX_STEP, DIAL_SWEEP / (count - 1));
}

/** The knob angle at which channel `index` sits; detents are centred on 12 o'clock. */
export function detentAngle(index: number, count: number): number {
  const step = detentStep(count);
  return -((count - 1) * step) / 2 + index * step;
}

/** The channel whose detent is nearest to a free-spinning `angle`. */
export function nearestDetent(angle: number, count: number): number {
  if (count <= 1) return 0;
  const step = detentStep(count);
  const start = detentAngle(0, count);
  const index = Math.round((angle - start) / step);
  return Math.min(count - 1, Math.max(0, index));
}

/** The furthest the knob may be dragged either way. */
export function clampAngle(angle: number, count: number): number {
  const limit = -detentAngle(0, count);
  return Math.min(limit, Math.max(-limit, angle));
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

/** Next / previous channel, wrapping. */
export function stepChannel(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return (((index + delta) % count) + count) % count;
}
