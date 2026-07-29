/**
 * Constants safe to import from both server and client code (no DB / Node
 * dependencies). Anything importable here must remain dependency-free of
 * `@libsql/client` so client bundles stay slim.
 */

/** Stable id for the seeded built-in Sleep category. Other code matches by id
 *  rather than by name so renaming "Sleep" doesn't break sleep-toggle UX. */
export const SLEEP_CATEGORY_ID = "sleep-system";

/** The primary concurrency lane. Everything written before parallel tracks
 *  existed lives here, so it doubles as the back-compat default. */
export const PRIMARY_TRACK = 0;

/** Highest addressable lane. Eight parallel activities is already well past
 *  what a person can honestly claim to be doing at once; the cap exists so a
 *  bad client can't scatter rows across unbounded lane numbers. */
export const MAX_TRACK = 7;

/** Lanes are a small dense range, so validity is just an integer bounds check. */
export function isValidTrack(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= PRIMARY_TRACK && v <= MAX_TRACK;
}
