/**
 * Shared input-validation helpers for the calendar API routes. Bounds and
 * length caps are deliberately generous — these protect against pathological
 * payloads (NaN/Infinity, megabyte strings, century-spanning ranges), not
 * against the user.
 */

import { addDays } from "@/lib/calendar-dates";

export const MAX_TITLE_LEN = 200;
export const MAX_NOTES_LEN = 10_000;
export const MAX_NAME_LEN = 80;
/** Max span for a `from..to` date-range query, inclusive. ~13 months. */
export const MAX_RANGE_DAYS = 400;
/** Bound for epoch ms inputs: years 2001..2100 (rejects negative, NaN, Infinity, year 30k). */
export const MIN_EPOCH_MS = 978307200000; // 2001-01-01T00:00:00Z
export const MAX_EPOCH_MS = 4102444800000; // 2100-01-01T00:00:00Z

export function isFiniteEpochMs(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= MIN_EPOCH_MS && v <= MAX_EPOCH_MS;
}

export function isFiniteInt32(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= -2_147_483_648 && v <= 2_147_483_647;
}

/** Returns null if `from..to` is in-range (and from <= to), else a reason string. */
export function checkDateRangeSpan(from: string, to: string): string | null {
  if (from > to) return "from must be <= to";
  // Cheap span check without Date math: compute addDays(from, MAX_RANGE_DAYS)
  // and compare strings lexicographically. YYYY-MM-DD sorts correctly.
  if (to > addDays(from, MAX_RANGE_DAYS)) return `range exceeds ${MAX_RANGE_DAYS} days`;
  return null;
}

export function isStringWithin(v: unknown, max: number): v is string {
  return typeof v === "string" && v.length <= max;
}
