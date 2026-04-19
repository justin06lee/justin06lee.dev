function formatDateInTz(date: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date);
}

export function todayInTz(timezone: string): string {
  return formatDateInTz(new Date(), timezone);
}

/** Validates a YYYY-MM-DD string. */
export function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Validates YYYY-MM string. */
export function isValidYearMonthString(s: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(s)) return false;
  const [, m] = s.split("-").map(Number);
  return m >= 1 && m <= 12;
}

/** Validates YYYY string. */
export function isValidYearString(s: string): boolean {
  return /^\d{4}$/.test(s);
}

/** Validates an HH:MM string (00:00–23:59). */
export function isValidHhmm(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** Adds days to a YYYY-MM-DD string; returns YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Returns first and last YYYY-MM-DD of a given month ("2026-04"). */
export function monthRange(yyyymm: string): { from: string; to: string } {
  const [y, m] = yyyymm.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return {
    from: `${y}-${mm}-01`,
    to: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

export const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

export const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * Returns a Sunday-aligned grid of YYYY-MM-DD strings for the given month,
 * with nulls for leading and trailing padding cells. Length is always a
 * multiple of 7.
 */
export function buildMonthGrid(yyyymm: string): (string | null)[] {
  const [y, m] = yyyymm.split("-").map(Number);
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) {
    cells.push(`${y}-${mm}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Parses HH:MM and returns minutes since midnight (0–1439), or null if invalid. */
export function hhmmToMinutes(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}
