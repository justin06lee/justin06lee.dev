/**
 * Constants safe to import from both server and client code (no DB / Node
 * dependencies). Anything importable here must remain dependency-free of
 * `@libsql/client` so client bundles stay slim.
 */

/** Stable id for the seeded built-in Sleep category. Other code matches by id
 *  rather than by name so renaming "Sleep" doesn't break sleep-toggle UX. */
export const SLEEP_CATEGORY_ID = "sleep-system";
